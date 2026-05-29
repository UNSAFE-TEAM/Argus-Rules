(() => {
  const TAG = "anti_injection";
  const DOS_FAKE_PATH = "C:\\Windows\\System32\\version.dll";
  const NT_FAKE_SUFFIX = "\\Windows\\System32\\version.dll";

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "K32GetMappedFileNameA", wide: false },
    { moduleName: "kernel32.dll", apiName: "K32GetMappedFileNameW", wide: true },
    { moduleName: "psapi.dll", apiName: "GetMappedFileNameA", wide: false },
    { moduleName: "psapi.dll", apiName: "GetMappedFileNameW", wide: true },
  ];

  const HIDDEN_KEYWORDS = ["frida", "gum", "argus"];

  function shouldHidePath(path) {
    return Agent.containsAny(path, HIDDEN_KEYWORDS);
  }

  function fakePath(original) {
    const match = String(original || "").match(/^(\\Device\\HarddiskVolume\d+)/i);

    if (match) {
      return `${match[1]}${NT_FAKE_SUFFIX}`;
    }

    return DOS_FAKE_PATH;
  }

  function hookGetMappedFileName(moduleName, apiName, wide) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.buffer = args[2];
        this.size = args[3].toUInt32();
      },

      onLeave(retval) {
        if (retval.toUInt32() === 0) {
          return;
        }

        const original = Agent.readString(this.buffer, wide);

        if (!shouldHidePath(original)) {
          return;
        }

        const current = fakePath(original);
        const written = Agent.writeString(this.buffer, this.size, current, wide);
        retval.replace(written);

        Agent.collect(
          TAG,
          moduleName,
          apiName,
          this.caller.toString(),
          [],
          [],
        );

        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: { module: original },
          current: { module: current },
        });
      },
    }));
  }

  function install(hook) {
    hookGetMappedFileName(hook.moduleName, hook.apiName, hook.wide);
  }

  Agent.safeCall(TAG, () => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => install(hook));
    }
  });
})();
