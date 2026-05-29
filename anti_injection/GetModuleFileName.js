(() => {
  const TAG = "anti_injection";
  const FAKE_MODULE_PATH = "C:\\Windows\\System32\\version.dll";

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetModuleFileNameA", wide: false },
    { moduleName: "kernel32.dll", apiName: "GetModuleFileNameW", wide: true },
    { moduleName: "kernelbase.dll", apiName: "GetModuleFileNameA", wide: false },
    { moduleName: "kernelbase.dll", apiName: "GetModuleFileNameW", wide: true },
  ];

  const HIDDEN_KEYWORDS = ["frida", "gum", "argus"];

  function shouldHidePath(path) {
    return Agent.containsAny(path, HIDDEN_KEYWORDS);
  }

  function hookGetModuleFileName(moduleName, apiName, wide) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.buffer = args[1];
        this.size = args[2].toUInt32();
      },

      onLeave(retval) {
        if (retval.toUInt32() === 0) {
          return;
        }

        const original = Agent.readString(this.buffer, wide);

        if (!shouldHidePath(original)) {
          return;
        }

        const written = Agent.writeString(
          this.buffer,
          this.size,
          FAKE_MODULE_PATH,
          wide,
        );
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
          current: { module: FAKE_MODULE_PATH },
        });
      },
    }));
  }

  function install(hook) {
    hookGetModuleFileName(hook.moduleName, hook.apiName, hook.wide);
  }

  Agent.safeCall(TAG, () => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => install(hook));
    }
  });
})();
