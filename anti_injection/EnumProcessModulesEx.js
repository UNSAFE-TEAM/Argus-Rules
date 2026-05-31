(() => {
  const Agent = globalThis.AgentV1;
  const TAG = "anti_injection";

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "K32EnumProcessModulesEx" },
    { moduleName: "psapi.dll", apiName: "EnumProcessModulesEx" },
  ];

  const ARG_SPEC = [
    { index: 0, name: "hProcess" },
    { index: 1, name: "lphModule" },
    { index: 2, name: "cb" },
    { index: 3, name: "lpcbNeeded" },
    { index: 4, name: "dwFilterFlag" },
  ];

  const HIDDEN_KEYWORDS = ["frida", "gum", "argus"];

  function shouldHideModule(module) {
    if (!module) {
      return false;
    }

    const name = String(module.name || "").toLowerCase();
    const path = String(module.path || "").toLowerCase();

    return Agent.containsAny(name, HIDDEN_KEYWORDS) || Agent.containsAny(path, HIDDEN_KEYWORDS);
  }

  function moduleFromHandle(handle) {
    if (!handle || handle.isNull()) {
      return null;
    }

    try {
      return Process.findModuleByAddress(handle);
    } catch (_) {
      return null;
    }
  }

  function hookEnum(moduleName, apiName) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.modules = args[1];
        this.size = args[2].toUInt32();
        this.needed = args[3];
      },

      onLeave(retval) {
        if (retval.toInt32() === 0 || !this.modules || this.modules.isNull()) {
          return;
        }

        const maxCount = Math.floor(this.size / Process.pointerSize);
        const visible = [];
        const hidden = [];

        for (let i = 0; i < maxCount; i++) {
          const slot = this.modules.add(i * Process.pointerSize);
          const handle = slot.readPointer();

          if (!handle || handle.isNull()) {
            continue;
          }

          const module = moduleFromHandle(handle);

          if (shouldHideModule(module)) {
            hidden.push(module.path || module.name || handle.toString());
          } else {
            visible.push(handle);
          }
        }

        if (hidden.length === 0) {
          return;
        }

        for (let i = 0; i < visible.length; i++) {
          this.modules.add(i * Process.pointerSize).writePointer(visible[i]);
        }

        if (this.needed && !this.needed.isNull()) {
          this.needed.writeU32(visible.length * Process.pointerSize);
        }

        Agent.collect(
          TAG,
          moduleName,
          apiName,
          this.caller.toString(),
          [],
          [],
        );

        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: { hidden: hidden.join(",") },
          current: { hidden: String(hidden.length) },
        });
      },
    }));
  }

  function install(hook) {
    hookEnum(hook.moduleName, hook.apiName);
  }

  Agent.safeCall(TAG, () => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => install(hook));
    }
  });
})();
