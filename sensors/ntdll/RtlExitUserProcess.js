(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RtlExitUserProcess";
  const TAG = "sensor";
  const MODULE_NAME = "ntdll.dll";
  const API_NAME = "RtlExitUserProcess";
  const EXIT_LOG_DELIVERY_DELAY_SECONDS = 0.1;

  function waitForExitLogDelivery() {
    try {
      Thread.sleep(EXIT_LOG_DELIVERY_DELAY_SECONDS);
    } catch (_) {
    }
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded(MODULE_NAME, () => {
      const moduleName = Agent.normalizeModuleName(MODULE_NAME);
      const apiName = API_NAME;
      const addr = Agent.getExport(moduleName, apiName);

      if (!addr) {
        return;
      }

      Interceptor.attach(addr, {
        onEnter(args) {
          if (globalThis.ArgusProcessExitSeen) {
            return;
          }
          globalThis.ArgusProcessExitSeen = true;

          Agent.log(
            "triggered",
            "behavior",
            {
              name: `${moduleName}!${apiName}`,
              address: Agent.callSiteAddressString(this.returnAddress),
            },
            {
              action: "process_exit",
              process: {
                exitCode: String(args[0].toInt32()),
              },
            },
          );
          waitForExitLogDelivery();
        },
      });

      Agent.register(TAG, moduleName, apiName);
    });
  });
})();
