(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "ws2_32.NameResolution";
  const TAG = "sensor";
  const API_HOOKS = [
    { moduleName: "ws2_32.dll", apiName: "GetAddrInfoW", wide: true },
    { moduleName: "ws2_32.dll", apiName: "gethostbyname", wide: false },
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
              host: Agent.readString(args[0], hook.wide),
              service: hook.apiName === "gethostbyname" ? "" : Agent.readString(args[1], hook.wide),
            };
            if (this.ctx.host) {
              sensor.emit(this.ctx);
            }
          },
        }));
      });
    }
  });
})();
