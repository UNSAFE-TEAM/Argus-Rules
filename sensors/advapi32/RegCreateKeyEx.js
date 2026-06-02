(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RegCreateKeyEx";
  const TAG = "sensor";
  const ERROR_SUCCESS = 0;
  const API_HOOKS = [
    { moduleName: "advapi32.dll", apiName: "RegCreateKeyExA", wide: false },
    { moduleName: "advapi32.dll", apiName: "RegCreateKeyExW", wide: true },
  ];

  globalThis.ArgusSensorState = globalThis.ArgusSensorState || {};
  ArgusSensorState.registryKeys = ArgusSensorState.registryKeys || {};

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
              subKey: Agent.readString(args[1], hook.wide),
              resultKey: args[7],
              disposition: args[8],
            };
            sensor.emit(this.ctx);
          },

          onLeave(retval) {
            const ctx = this.ctx;

            if (
              retval.toInt32() !== ERROR_SUCCESS ||
              !ctx.resultKey ||
              ctx.resultKey.isNull()
            ) {
              return;
            }

            const keyPath = ArgusRegistryPathV1.join(ctx.keyPath, ctx.subKey);
            ArgusSensorState.registryKeys[ctx.resultKey.readPointer().toString()] =
              keyPath;
          },
        }));
      });
    }
  });
})();
