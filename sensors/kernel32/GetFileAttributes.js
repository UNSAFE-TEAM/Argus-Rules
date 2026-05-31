(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "GetFileAttributes";
  const TAG = "sensor";
  const INVALID_FILE_ATTRIBUTES = 0xffffffff;
  const ERROR_FILE_NOT_FOUND = 2;

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetFileAttributesA", wide: false },
    { moduleName: "kernel32.dll", apiName: "GetFileAttributesW", wide: true },
    { moduleName: "kernelbase.dll", apiName: "GetFileAttributesA", wide: false },
    { moduleName: "kernelbase.dll", apiName: "GetFileAttributesW", wide: true },
  ];

  let setLastError = null;

  function setError(code) {
    if (!setLastError) {
      setLastError = new NativeFunction(
        Agent.mustGetExport("kernel32.dll", "SetLastError"),
        "void",
        ["uint32"],
      );
    }

    setLastError(code);
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
              path: Agent.readString(args[0], hook.wide),
              originalAttributes: null,
              currentAttributes: null,
              action: null,

              notFound(error = ERROR_FILE_NOT_FOUND) {
                this.currentAttributes = INVALID_FILE_ATTRIBUTES;
                this.lastError = error;
                this.action = "not_found";
              },
            };
          },

          onLeave(retval) {
            const ctx = this.ctx;
            ctx.originalAttributes = retval.toUInt32();
            ctx.currentAttributes = ctx.originalAttributes;

            sensor.emit(ctx);

            if (ctx.currentAttributes !== ctx.originalAttributes) {
              retval.replace(ctx.currentAttributes);
              try {
                setError(ctx.lastError || ERROR_FILE_NOT_FOUND);
              } catch (_) {}
            }
          },
        }));
      });
    }
  });
})();
