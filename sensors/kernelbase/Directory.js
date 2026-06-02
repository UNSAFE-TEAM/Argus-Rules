(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "Directory";
  const TAG = "sensor";
  const API_HOOKS = [
    ["CreateDirectoryA", false, "create_directory"],
    ["CreateDirectoryW", true, "create_directory"],
    ["RemoveDirectoryA", false, "remove_directory"],
    ["RemoveDirectoryW", true, "remove_directory"],
  ].map((item) => ({
    moduleName: "kernelbase.dll",
    apiName: item[0],
    wide: item[1],
    action: item[2],
  }));

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
              action: hook.action,
              path: Agent.readString(args[0], hook.wide),
            };
            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
