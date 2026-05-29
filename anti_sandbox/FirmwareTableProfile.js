(() => {
  const TAG = "anti_sandbox";

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetSystemFirmwareTable" },
    { moduleName: "kernelbase.dll", apiName: "GetSystemFirmwareTable" },
  ];

  const SIGNATURES = [
    { original: "VMware", current: "LENOVO" },
    { original: "VMWARE", current: "LENOVO" },
    { original: "VBOX__", current: "LENOV_" },
    { original: "VirtualBox", current: "LENOVOBOX_" },
    { original: "QEMU", current: "LENO" },
  ];

  function signatureName(value) {
    return String.fromCharCode(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
  }

  function patchAscii(buffer, size) {
    const patched = [];

    if (!buffer || buffer.isNull() || size <= 0) {
      return patched;
    }

    for (const signature of SIGNATURES) {
      const original = signature.original;
      const current = signature.current;

      if (original.length !== current.length) {
        continue;
      }

      const needle = [];
      const replacement = [];

      for (let i = 0; i < original.length; i++) {
        needle.push(original.charCodeAt(i) & 0xff);
        replacement.push(current.charCodeAt(i) & 0xff);
      }

      for (let offset = 0; offset <= size - needle.length; offset++) {
        let matched = true;

        for (let i = 0; i < needle.length; i++) {
          if (buffer.add(offset + i).readU8() !== needle[i]) {
            matched = false;
            break;
          }
        }

        if (!matched) {
          continue;
        }

        for (let i = 0; i < replacement.length; i++) {
          buffer.add(offset + i).writeU8(replacement[i]);
        }

        patched.push(original);
      }
    }

    return patched;
  }

  function hookFirmwareTable(moduleName, apiName) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.provider = args[0].toUInt32();
        this.tableId = args[1].toUInt32();
        this.buffer = args[2];
        this.size = args[3].toUInt32();
      },

      onLeave(retval) {
        const returned = retval.toUInt32();

        if (returned === 0 || !this.buffer || this.buffer.isNull()) {
          return;
        }

        const patchSize = Math.min(returned, this.size);
        const patched = patchAscii(this.buffer, patchSize);

        if (patched.length === 0) {
          return;
        }

        Agent.collect(TAG, moduleName, apiName, this.caller.toString(), [], []);
        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: {
            provider: signatureName(this.provider),
            tableId: signatureName(this.tableId),
            signatures: patched.join(","),
          },
          current: {
            signatures: "patched",
          },
        });
      },
    }));
  }

  function install(hook) {
    hookFirmwareTable(hook.moduleName, hook.apiName);
  }

  Agent.safeCall(TAG, () => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => install(hook));
    }
  });
})();
