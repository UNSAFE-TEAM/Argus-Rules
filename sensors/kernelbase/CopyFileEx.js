(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "CopyFileEx";
  const TAG = "sensor";
  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "CopyFileExA", wide: false },
    { moduleName: "kernelbase.dll", apiName: "CopyFileExW", wide: true },
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
              existingPath: Agent.readString(args[0], hook.wide),
              newPath: Agent.readString(args[1], hook.wide),
              copyFlags: args[5].toUInt32(),
            };
            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
