(() => {
  const TAG = "anti_sandbox";
  const LOGICAL_PROCESSORS = 8;

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetSystemInfo" },
    { moduleName: "kernel32.dll", apiName: "GetNativeSystemInfo" },
  ];

  function numberOfProcessorsOffset() {
    return Process.pointerSize === 8 ? 32 : 20;
  }

  function hookSystemInfo(moduleName, apiName) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.info = args[0];
      },

      onLeave(_retval) {
        if (!this.info || this.info.isNull()) {
          return;
        }

        const field = this.info.add(numberOfProcessorsOffset());
        const original = field.readU32();

        if (original === LOGICAL_PROCESSORS) {
          return;
        }

        field.writeU32(LOGICAL_PROCESSORS);

        Agent.collect(TAG, moduleName, apiName, this.caller.toString(), [], []);
        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: { numberOfProcessors: String(original) },
          current: { numberOfProcessors: String(LOGICAL_PROCESSORS) },
        });
      },
    }));
  }

  function install(hook) {
    hookSystemInfo(hook.moduleName, hook.apiName);
  }

  Agent.safeCall(TAG, () => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => install(hook));
    }
  });
})();
