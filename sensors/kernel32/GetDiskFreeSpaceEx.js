(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "GetDiskFreeSpaceEx";
  const TAG = "sensor";

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetDiskFreeSpaceExA", wide: false },
    { moduleName: "kernel32.dll", apiName: "GetDiskFreeSpaceExW", wide: true },
    { moduleName: "kernelbase.dll", apiName: "GetDiskFreeSpaceExA", wide: false },
    { moduleName: "kernelbase.dll", apiName: "GetDiskFreeSpaceExW", wide: true },
  ];

  function readOptionalU64(ptrValue) {
    if (!ptrValue || ptrValue.isNull()) {
      return "";
    }

    return ptrValue.readU64().toString();
  }

  function writeOptionalU64(ptrValue, value) {
    if (ptrValue && !ptrValue.isNull()) {
      ptrValue.writeU64(value);
    }
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              wide: hook.wide,
              caller: this.returnAddress.toString(),
              directory: Agent.readString(args[0], hook.wide),
              availablePtr: args[1],
              totalPtr: args[2],
              freePtr: args[3],
              availableBytes: "",
              totalBytes: "",
              freeBytes: "",
              action: null,

              setDiskSpace(totalBytes, freeBytes, availableBytes = freeBytes) {
                writeOptionalU64(this.totalPtr, totalBytes);
                writeOptionalU64(this.freePtr, freeBytes);
                writeOptionalU64(this.availablePtr, availableBytes);
                this.currentTotalBytes = totalBytes.toString();
                this.currentFreeBytes = freeBytes.toString();
                this.action = "set_disk_space";
              },
            };
          },

          onLeave(retval) {
            const ctx = this.ctx;

            if (retval.toInt32() === 0) {
              return;
            }

            ctx.availableBytes = readOptionalU64(ctx.availablePtr);
            ctx.totalBytes = readOptionalU64(ctx.totalPtr);
            ctx.freeBytes = readOptionalU64(ctx.freePtr);
            sensor.emit(ctx);
          },
        }));
      });
    }
  });
})();
