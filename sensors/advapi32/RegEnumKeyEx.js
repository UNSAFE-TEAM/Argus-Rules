(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RegEnumKeyEx";
  const TAG = "sensor";
  const ERROR_SUCCESS = 0;
  const ERROR_NO_MORE_ITEMS = 259;

  const API_HOOKS = [
    { moduleName: "advapi32.dll", apiName: "RegEnumKeyExA", wide: false },
    { moduleName: "advapi32.dll", apiName: "RegEnumKeyExW", wide: true },
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
              keyHandle: args[0],
              index: args[1].toUInt32(),
              nameBuffer: args[2],
              nameSize: args[3],
              originalStatus: null,
              currentStatus: null,
              originalName: "",
              action: null,

              stopEnumeration(status = ERROR_NO_MORE_ITEMS) {
                this.currentStatus = status;
                this.action = "stop_enumeration";
              },
            };
          },

          onLeave(retval) {
            const ctx = this.ctx;
            ctx.originalStatus = retval.toInt32();
            ctx.currentStatus = ctx.originalStatus;

            if (ctx.originalStatus === ERROR_SUCCESS) {
              ctx.originalName = Agent.readString(ctx.nameBuffer, hook.wide);
            }

            sensor.emit(ctx);

            if (ctx.currentStatus !== ctx.originalStatus) {
              retval.replace(ctx.currentStatus);
            }
          },
        }));
      });
    }
  });
})();
