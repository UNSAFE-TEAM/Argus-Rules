(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "SetFileAttributes";
  const TAG = "sensor";
  const API_HOOKS = [
    { moduleName: "kernelbase.dll", apiName: "SetFileAttributesA", wide: false },
    { moduleName: "kernelbase.dll", apiName: "SetFileAttributesW", wide: true },
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
              path: Agent.readString(args[0], hook.wide),
              attributes: args[1].toUInt32(),
            };
            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
