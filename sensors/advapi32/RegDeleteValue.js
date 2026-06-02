(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RegDeleteValue";
  const TAG = "sensor";
  const ERROR_SUCCESS = 0;
  const API_HOOKS = [
    { moduleName: "advapi32.dll", apiName: "RegDeleteValueA", wide: false },
    { moduleName: "advapi32.dll", apiName: "RegDeleteValueW", wide: true },
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
              keyHandle: args[0],
              keyPath: ArgusRegistryPathV1.keyName(
                args[0],
                ArgusSensorState.registryKeys,
              ),
              valueName: Agent.readString(args[1], hook.wide),
            };
            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
