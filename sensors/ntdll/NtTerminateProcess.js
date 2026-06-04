(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "NtTerminateProcess";
  const TAG = "sensor";
  const MODULE_NAME = "ntdll.dll";
  const API_NAME = "NtTerminateProcess";
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
          const ctx = {
            sensor: SENSOR_NAME,
            moduleName,
            apiName,
            caller: this.returnAddress.toString(),
            targetHandle: args[0],
            exitCode: args[1].toInt32(),
          };

          const targetHandle = ctx.targetHandle ? ctx.targetHandle.toString() : "";
          const isCurrentProcess =
            targetHandle === "0xffffffffffffffff" || targetHandle === "-1";

          if (isCurrentProcess) {
            if (globalThis.ArgusProcessExitSeen) {
              return;
            }
            globalThis.ArgusProcessExitSeen = true;

            Agent.log(
              "triggered",
              "behavior",
              {
                name: `${moduleName}!${apiName}`,
                address: Agent.callSiteAddressString(ctx.caller),
              },
              {
                action: "process_exit",
                process: {
                  targetHandle,
                  exitCode: String(ctx.exitCode),
                },
              },
            );
            waitForExitLogDelivery();
            return;
          }

          sensor.emit(ctx);
        },
      });

      Agent.register(TAG, moduleName, apiName);
    });
  });
})();
