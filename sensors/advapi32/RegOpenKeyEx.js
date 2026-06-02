(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RegOpenKeyEx";
  const TAG = "sensor";
  const ERROR_SUCCESS = 0;
  const ERROR_FILE_NOT_FOUND = 2;

  const API_HOOKS = [
    { moduleName: "advapi32.dll", apiName: "RegOpenKeyExA", wide: false },
    { moduleName: "advapi32.dll", apiName: "RegOpenKeyExW", wide: true },
  ];

  globalThis.ArgusSensorState = globalThis.ArgusSensorState || {};
  ArgusSensorState.registryKeys = ArgusSensorState.registryKeys || {};

  function readSubKey(ptrValue, wide) {
    return Agent.readString(ptrValue, wide);
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
              rootKey: args[0],
              keyPath: ArgusRegistryPathV1.keyName(
                args[0],
                ArgusSensorState.registryKeys,
              ),
              subKey: readSubKey(args[1], hook.wide),
              options: args[2],
              samDesired: args[3],
              resultKey: args[4],
              originalStatus: null,
              currentStatus: null,
              action: null,

              hide(status = ERROR_FILE_NOT_FOUND) {
                this.currentStatus = status;
                this.action = "hide";
              },
            };
          },

          onLeave(retval) {
            const ctx = this.ctx;
            ctx.originalStatus = retval.toInt32();
            ctx.currentStatus = ctx.originalStatus;

            sensor.emit(ctx);

            if (ctx.currentStatus !== ctx.originalStatus) {
              retval.replace(ctx.currentStatus);
            }

            if (
              ctx.currentStatus === ERROR_SUCCESS &&
              ctx.resultKey &&
              !ctx.resultKey.isNull()
            ) {
              const keyPath = ArgusRegistryPathV1.join(ctx.keyPath, ctx.subKey);
              ArgusSensorState.registryKeys[ctx.resultKey.readPointer().toString()] =
                keyPath;
            }
          },
        }));
      });
    }
  });
})();
