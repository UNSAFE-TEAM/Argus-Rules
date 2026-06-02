(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "WriteFile";
  const TAG = "sensor";
  const MODULE_NAME = "kernelbase.dll";
  const API_NAME = "WriteFile";

  globalThis.ArgusSensorState = globalThis.ArgusSensorState || {};
  ArgusSensorState.fileHandles = ArgusSensorState.fileHandles || {};

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded(MODULE_NAME, () => {
      Agent.attachApi(TAG, MODULE_NAME, API_NAME, () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: MODULE_NAME,
            apiName: API_NAME,
            caller: this.returnAddress.toString(),
            handle: args[0],
            path: ArgusSensorState.fileHandles[args[0].toString()] || "",
            bytesRequested: args[2].toUInt32(),
            bytesWrittenPtr: args[3],
          };
          sensor.emit(this.ctx);
        },
      }));
    });
  });
})();
