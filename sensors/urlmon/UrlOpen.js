(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "urlmon.UrlOpen";
  const TAG = "sensor";
  const API_HOOKS = [
    { moduleName: "urlmon.dll", apiName: "URLDownloadToFileA", wide: false },
    { moduleName: "urlmon.dll", apiName: "URLDownloadToFileW", wide: true },
    { moduleName: "urlmon.dll", apiName: "URLOpenBlockingStreamA", wide: false },
    { moduleName: "urlmon.dll", apiName: "URLOpenBlockingStreamW", wide: true },
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
              url: Agent.readString(args[1], hook.wide),
            };

            if (this.ctx.url) {
              sensor.emit(this.ctx);
            }
          },
        }));
      });
    }
  });
})();
