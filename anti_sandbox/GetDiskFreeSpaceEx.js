(() => {
  const TAG = "anti_sandbox";
  const TOTAL_BYTES = new UInt64("549755813888");
  const FREE_BYTES = new UInt64("412316860416");

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetDiskFreeSpaceExA" },
    { moduleName: "kernel32.dll", apiName: "GetDiskFreeSpaceExW" },
    { moduleName: "kernelbase.dll", apiName: "GetDiskFreeSpaceExA" },
    { moduleName: "kernelbase.dll", apiName: "GetDiskFreeSpaceExW" },
  ];

  const ARG_SPEC = [
    { index: 0, name: "lpDirectoryName" },
    { index: 1, name: "lpFreeBytesAvailableToCaller" },
    { index: 2, name: "lpTotalNumberOfBytes" },
    { index: 3, name: "lpTotalNumberOfFreeBytes" },
  ];

  function writeOptionalU64(ptrValue, value) {
    if (ptrValue && !ptrValue.isNull()) {
      ptrValue.writeU64(value);
    }
  }

  function hookDiskSpace(moduleName, apiName) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.args = args;
        this.totalPtr = args[2];
        this.freePtr = args[3];
        this.availablePtr = args[1];
      },

      onLeave(retval) {
        if (retval.toInt32() === 0) {
          return;
        }

        const originalTotal =
          this.totalPtr && !this.totalPtr.isNull()
            ? this.totalPtr.readU64().toString()
            : "";

        writeOptionalU64(this.totalPtr, TOTAL_BYTES);
        writeOptionalU64(this.freePtr, FREE_BYTES);
        writeOptionalU64(this.availablePtr, FREE_BYTES);

        Agent.collect(
          TAG,
          moduleName,
          apiName,
          this.caller.toString(),
          this.args,
          ARG_SPEC,
        );

        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: { totalBytes: originalTotal },
          current: { totalBytes: TOTAL_BYTES.toString() },
        });
      },
    }));
  }

  function install(hook) {
    hookDiskSpace(hook.moduleName, hook.apiName);
  }

  Agent.safeCall(TAG, () => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => install(hook));
    }
  });
})();
