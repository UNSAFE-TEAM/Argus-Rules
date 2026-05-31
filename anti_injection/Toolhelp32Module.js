(() => {
  const Agent = globalThis.AgentV1;
  const TAG = "anti_injection";
  const MODULE_NAME = "kernel32.dll";

  const API_HOOKS = [
    { apiName: "Module32FirstA", nextApiName: "Module32NextA", wide: false },
    { apiName: "Module32FirstW", nextApiName: "Module32NextW", wide: true },
    { apiName: "Module32NextA", nextApiName: "Module32NextA", wide: false },
    { apiName: "Module32NextW", nextApiName: "Module32NextW", wide: true },
  ];

  const MODULE_ENTRY_OFFSETS = {
    x86: {
      szModule: 32,
      szExePathA: 288,
      szExePathW: 544,
    },
    x64: {
      szModule: 56,
      szExePathA: 312,
      szExePathW: 560,
    },
  };

  const hookedApis = {};
  let skipping = false;
  const HIDDEN_KEYWORDS = ["frida", "gum", "argus"];

  function offsets() {
    return Process.pointerSize === 8
      ? MODULE_ENTRY_OFFSETS.x64
      : MODULE_ENTRY_OFFSETS.x86;
  }

  function shouldHidePath(path) {
    return Agent.containsAny(path, HIDDEN_KEYWORDS);
  }

  function readModulePath(entry, wide) {
    if (!entry || entry.isNull()) {
      return "";
    }

    const offset = wide ? offsets().szExePathW : offsets().szExePathA;
    const field = entry.add(offset);

    try {
      return Agent.readString(field, wide);
    } catch (_) {
      return "";
    }
  }

  function callNext(nextAddress, snapshot, entry) {
    const next = new NativeFunction(nextAddress, "int", ["pointer", "pointer"]);

    skipping = true;

    try {
      return next(snapshot, entry) !== 0;
    } finally {
      skipping = false;
    }
  }

  function findOptionalExport(moduleName, apiName) {
    const module = Process.findModuleByName(moduleName);

    if (!module) {
      return null;
    }

    try {
      if (typeof module.findExportByName === "function") {
        return module.findExportByName(apiName);
      }

      if (typeof module.getExportByName === "function") {
        return module.getExportByName(apiName);
      }
    } catch (_) {
      return null;
    }

    return null;
  }

  function hookModuleEnum(apiName, nextApiName, wide) {
    const addr = findOptionalExport(MODULE_NAME, apiName);
    const nextAddress = findOptionalExport(MODULE_NAME, nextApiName);

    if (!addr || !nextAddress) {
      Agent.skip(TAG, Agent.apiSubject(MODULE_NAME, apiName), {
        reason: "export_not_found",
      });

      return;
    }

    Interceptor.attach(addr, {
      onEnter(args) {
        this.caller = this.returnAddress;
        this.snapshot = args[0];
        this.entry = args[1];
      },

      onLeave(retval) {
        if (skipping) {
          return;
        }

        if (retval.toInt32() === 0 || !this.entry || this.entry.isNull()) {
          return;
        }

        const hidden = [];
        let path = readModulePath(this.entry, wide);

        while (shouldHidePath(path)) {
          hidden.push(path);

          if (!callNext(nextAddress, this.snapshot, this.entry)) {
            retval.replace(0);
            break;
          }

          path = readModulePath(this.entry, wide);
        }

        if (hidden.length === 0) {
          return;
        }

        Agent.collect(
          TAG,
          MODULE_NAME,
          apiName,
          this.caller.toString(),
          [],
          [],
        );

        Agent.triggered(TAG, MODULE_NAME, apiName, this.caller.toString(), {
          original: { hidden: hidden.join(",") },
          current: { hidden: String(hidden.length) },
        });
      },
    });

    Agent.register(TAG, MODULE_NAME, apiName);
  }

  function install(apiName, nextApiName, wide) {
    const key = `${MODULE_NAME}!${apiName}`;

    if (hookedApis[key]) {
      return;
    }

    hookedApis[key] = true;
    hookModuleEnum(apiName, nextApiName, wide);
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded(MODULE_NAME, () => {
      for (const hook of API_HOOKS) {
        install(hook.apiName, hook.nextApiName, hook.wide);
      }
    });
  });
})();
