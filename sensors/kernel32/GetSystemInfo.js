(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "GetSystemInfo";
  const TAG = "sensor";

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetSystemInfo" },
    { moduleName: "kernel32.dll", apiName: "GetNativeSystemInfo" },
  ];

  function numberOfProcessorsOffset() {
    return Process.pointerSize === 8 ? 32 : 20;
  }

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
              info: args[0],
              numberOfProcessors: null,
              action: null,

              setNumberOfProcessors(value) {
                if (!this.info || this.info.isNull()) {
                  return false;
                }

                this.info.add(numberOfProcessorsOffset()).writeU32(value);
                this.currentNumberOfProcessors = value;
                this.action = "set_number_of_processors";
                return true;
              },
            };
          },

          onLeave(_retval) {
            const ctx = this.ctx;

            if (!ctx.info || ctx.info.isNull()) {
              return;
            }

            ctx.numberOfProcessors = ctx.info.add(numberOfProcessorsOffset()).readU32();
            sensor.emit(ctx);
          },
        }));
      });
    }
  });
})();
