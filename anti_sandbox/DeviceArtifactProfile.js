(() => {
  const TAG = "anti_sandbox";
  const INVALID_HANDLE_VALUE = ptr("-1");
  const ERROR_FILE_NOT_FOUND = 2;

  const HIDDEN_DEVICES = ["\\\\.\\hgfs", "\\\\.\\vmci"];

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "CreateFileA", wide: false },
    { moduleName: "kernel32.dll", apiName: "CreateFileW", wide: true },
    { moduleName: "kernelbase.dll", apiName: "CreateFileA", wide: false },
    { moduleName: "kernelbase.dll", apiName: "CreateFileW", wide: true },
  ];

  let setLastError = null;

  function normalizeDeviceName(path) {
    return String(path || "").toLowerCase().replaceAll("/", "\\");
  }

  function shouldHideDevice(path) {
    return HIDDEN_DEVICES.includes(normalizeDeviceName(path));
  }

  function setFileNotFound() {
    if (!setLastError) {
      setLastError = new NativeFunction(
        Agent.mustGetExport("kernel32.dll", "SetLastError"),
        "void",
        ["uint32"],
      );
    }

    setLastError(ERROR_FILE_NOT_FOUND);
  }

  function hookCreateFile(moduleName, apiName, wide) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.path = Agent.readString(args[0], wide);
        this.hide = shouldHideDevice(this.path);
      },

      onLeave(retval) {
        if (!this.hide) {
          return;
        }

        retval.replace(INVALID_HANDLE_VALUE);

        try {
          setFileNotFound();
        } catch (_) {}

        Agent.collect(TAG, moduleName, apiName, this.caller.toString(), [], []);
        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: { device: this.path },
          current: { device: "hidden" },
        });
      },
    }));
  }

  function install(hook) {
    hookCreateFile(hook.moduleName, hook.apiName, hook.wide);
  }

  Agent.safeCall(TAG, () => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => install(hook));
    }
  });
})();
