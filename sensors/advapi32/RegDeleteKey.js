(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RegDeleteKey";
  const TAG = "sensor";
  const ERROR_SUCCESS = 0;
  const API_HOOKS = [
    { moduleName: "advapi32.dll", apiName: "RegDeleteKeyA", wide: false },
    { moduleName: "advapi32.dll", apiName: "RegDeleteKeyW", wide: true },
  ];

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
              subKey: Agent.readString(args[1], hook.wide),
            };
            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
