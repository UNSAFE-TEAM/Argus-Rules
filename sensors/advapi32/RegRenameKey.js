(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RegRenameKey";
  const TAG = "sensor";
  const MODULE_NAME = "advapi32.dll";
  const API_NAME = "RegRenameKey";
  const ERROR_SUCCESS = 0;

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded(MODULE_NAME, () => {
      Agent.attachApi(TAG, MODULE_NAME, API_NAME, () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: MODULE_NAME,
            apiName: API_NAME,
            caller: this.returnAddress.toString(),
            keyHandle: args[0],
            subKey: Agent.readUtf16(args[1]),
            newName: Agent.readUtf16(args[2]),
          };
          sensor.emit(this.ctx);
        },
      }));
    });
  });
})();
