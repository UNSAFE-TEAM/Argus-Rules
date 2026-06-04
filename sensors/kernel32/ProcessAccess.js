(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "ProcessAccess";
  const TAG = "sensor";
  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "OpenProcess" },
    { moduleName: "kernelbase.dll", apiName: "OpenProcess" },
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
              caller: this.returnAddress.toString(),
              desiredAccess: args[0].toUInt32(),
              inheritHandle: args[1].toUInt32(),
              processId: args[2].toUInt32(),
              handle: null,
            };
          },

          onLeave(retval) {
            this.ctx.handle = retval;
            if (!retval.isNull()) {
              sensor.emit(this.ctx);
            }
          },
        }));
      });
    }
  });
})();
