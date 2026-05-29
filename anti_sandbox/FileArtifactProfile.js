(() => {
  const TAG = "anti_sandbox";
  const INVALID_FILE_ATTRIBUTES = 0xffffffff;
  const ERROR_FILE_NOT_FOUND = 2;

  const HIDDEN_FILES = [
    "vmnet.sys",
    "vmmouse.sys",
    "vmusb.sys",
    "vm3dmp.sys",
    "vmci.sys",
    "vmhgfs.sys",
    "vmmemctl.sys",
    "vmx86.sys",
    "vmrawdsk.sys",
    "vmusbmouse.sys",
    "vmkdb.sys",
    "vmnetuserif.sys",
    "vmnetadapter.sys",
  ];
  const HIDDEN_DIRECTORIES = ["\\vmware\\"];

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetFileAttributesA", wide: false },
    { moduleName: "kernel32.dll", apiName: "GetFileAttributesW", wide: true },
    { moduleName: "kernelbase.dll", apiName: "GetFileAttributesA", wide: false },
    { moduleName: "kernelbase.dll", apiName: "GetFileAttributesW", wide: true },
  ];

  let setLastError = null;

  function shouldHideFile(path) {
    const normalized = String(path || "").toLowerCase().replaceAll("/", "\\");

    if (
      normalized.includes("\\system32\\drivers\\") &&
      Agent.containsAny(normalized, HIDDEN_FILES)
    ) {
      return true;
    }

    return Agent.containsAny(normalized, HIDDEN_DIRECTORIES);
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

  function hookGetFileAttributes(moduleName, apiName, wide) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.path = Agent.readString(args[0], wide);
      },

      onLeave(retval) {
        if (!shouldHideFile(this.path)) {
          return;
        }

        retval.replace(INVALID_FILE_ATTRIBUTES);

        try {
          setFileNotFound();
        } catch (_) {}

        Agent.collect(TAG, moduleName, apiName, this.caller.toString(), [], []);
        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: { file: this.path },
          current: { file: "hidden" },
        });
      },
    }));
  }

  function install(hook) {
    hookGetFileAttributes(hook.moduleName, hook.apiName, hook.wide);
  }

  Agent.safeCall(TAG, () => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => install(hook));
    }
  });
})();
