(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "CreateFile";
  const TAG = "sensor";
  const INVALID_HANDLE_VALUE = ptr("-1");
  const ERROR_FILE_NOT_FOUND = 2;

  const API_HOOKS = [
    { moduleName: "kernelbase.dll", apiName: "CreateFileA", wide: false },
    { moduleName: "kernelbase.dll", apiName: "CreateFileW", wide: true },
  ];

  globalThis.ArgusSensorState = globalThis.ArgusSensorState || {};
  ArgusSensorState.fileHandles = ArgusSensorState.fileHandles || {};

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
              desiredAccess: args[1],
              shareMode: args[2],
              securityAttributes: args[3],
              creationDisposition: args[4],
              flagsAndAttributes: args[5],
              templateFile: args[6],
              originalHandle: null,
              currentHandle: null,
              action: null,

              fail(error = ERROR_FILE_NOT_FOUND) {
                this.currentHandle = INVALID_HANDLE_VALUE;
                this.lastError = error;
                this.action = "fail";
              },
            };

            sensor.emit(this.ctx);
          },

          onLeave(retval) {
            const ctx = this.ctx;
            ctx.originalHandle = retval;
            if (ctx.currentHandle === null) {
              ctx.currentHandle = retval;
            }

            if (ctx.currentHandle !== ctx.originalHandle) {
              retval.replace(ctx.currentHandle);
              try {
                setError(ctx.lastError || ERROR_FILE_NOT_FOUND);
              } catch (_) {}
            } else if (
              ctx.currentHandle &&
              !ctx.currentHandle.isNull() &&
              ctx.currentHandle.toString() !== INVALID_HANDLE_VALUE.toString()
            ) {
              ArgusSensorState.fileHandles[ctx.currentHandle.toString()] = ctx.path;
            }
          },
        }));
      });
    }
  });
})();
