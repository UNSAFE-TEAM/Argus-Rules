(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "dnsapi.DnsQuery";
  const TAG = "sensor";
  const ERROR_SUCCESS = 0;
  const API_HOOKS = [
    { moduleName: "dnsapi.dll", apiName: "DnsQuery_A", wide: false },
    { moduleName: "dnsapi.dll", apiName: "DnsQuery_W", wide: true },
    { moduleName: "dnsapi.dll", apiName: "DnsQuery_UTF8", wide: false },
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
              query: Agent.readString(args[0], hook.wide),
              queryType: args[1].toUInt32(),
              options: args[2].toUInt32(),
            };
            if (this.ctx.query) {
              sensor.emit(this.ctx);
            }
          },
        }));
      });
    }
  });
})();
