(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "ExitProcess";
  const TAG = "sensor";

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "ExitProcess" },
    { moduleName: "kernelbase.dll", apiName: "ExitProcess" },
  ];
  const EXIT_LOG_DELIVERY_DELAY_SECONDS = 0.1;

  function waitForExitLogDelivery() {
    try {
      Thread.sleep(EXIT_LOG_DELIVERY_DELAY_SECONDS);
    } catch (_) {
    }
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        const moduleName = Agent.normalizeModuleName(hook.moduleName);
        const apiName = hook.apiName;
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
    }
  });
})();
