(() => {
  const TAG = "anti_injection";
  const MODULE_NAME = "ntdll.dll";
  const API_NAME = "LdrEnumerateLoadedModules";

  const LDR_DATA_TABLE_ENTRY_OFFSETS = {
    x86: {
      fullDllName: 0x24,
    },
    x64: {
      fullDllName: 0x48,
    },
  };

  let installed = false;
  let originalCallback = null;

  function offsets() {
    return Process.pointerSize === 8
      ? LDR_DATA_TABLE_ENTRY_OFFSETS.x64
      : LDR_DATA_TABLE_ENTRY_OFFSETS.x86;
  }

  function readUnicodeString(unicodeString) {
    if (!unicodeString || unicodeString.isNull()) {
      return "";
    }

    try {
      const length = unicodeString.readU16();
      const bufferOffset = Process.pointerSize === 8 ? 8 : 4;
      const buffer = unicodeString.add(bufferOffset).readPointer();

      if (!buffer || buffer.isNull() || length === 0) {
        return "";
      }

      return buffer.readUtf16String(length / 2);
    } catch (_) {
      return "";
    }
  }

  function readFullDllName(ldrEntry) {
    if (!ldrEntry || ldrEntry.isNull()) {
      return "";
    }

    return readUnicodeString(ldrEntry.add(offsets().fullDllName));
  }

  function shouldHidePath(path) {
    const normalized = String(path || "").toLowerCase();

    return (
      normalized.includes("frida") ||
      normalized.includes("gum") ||
      normalized.includes("argus")
    );
  }

  function install() {
    if (installed) {
      return;
    }

    const addr = Agent.getExport(MODULE_NAME, API_NAME);

    Interceptor.attach(addr, {
      onEnter(args) {
        this.caller = this.returnAddress;
        this.originalCallback = args[1];
        this.hidden = [];
        originalCallback = new NativeFunction(this.originalCallback, "void", [
          "pointer",
          "pointer",
          "pointer",
        ]);

        const state = this;

        this.filteredCallback = new NativeCallback(
          (ldrEntry, parameter, stop) => {
            const path = readFullDllName(ldrEntry);

            if (shouldHidePath(path)) {
              state.hidden.push(path);
              return;
            }

            originalCallback(ldrEntry, parameter, stop);
          },
          "void",
          ["pointer", "pointer", "pointer"],
        );

        args[1] = this.filteredCallback;
      },

      onLeave(_retval) {
        if (this.hidden.length === 0) {
          return;
        }

        Agent.collect(
          TAG,
          MODULE_NAME,
          API_NAME,
          this.caller.toString(),
          [],
          [],
        );

        Agent.triggered(TAG, MODULE_NAME, API_NAME, this.caller.toString(), {
          original: { hidden: this.hidden.join(",") },
          current: { hidden: String(this.hidden.length) },
        });
      },
    });

    installed = true;
    Agent.register(TAG, MODULE_NAME, API_NAME);
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded(MODULE_NAME, install);
  });
})();
