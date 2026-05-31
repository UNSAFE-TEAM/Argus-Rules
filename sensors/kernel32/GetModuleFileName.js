(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "kernel32.GetModuleFileName";
  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetModuleFileNameA", wide: false },
    { moduleName: "kernel32.dll", apiName: "GetModuleFileNameW", wide: true },
    { moduleName: "kernelbase.dll", apiName: "GetModuleFileNameA", wide: false },
    { moduleName: "kernelbase.dll", apiName: "GetModuleFileNameW", wide: true },
  ];

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi("sensor", hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              wide: hook.wide,
              caller: this.returnAddress.toString(),
              moduleHandle: args[0],
              buffer: args[1],
              size: args[2].toUInt32(),
              retval: null,
              original: "",

              replaceString(value) {
                const written = Agent.writeString(this.buffer, this.size, value, this.wide);
                this.retval.replace(written);
                this.current = value;
                return written;
              },
            };
          },

          onLeave(retval) {
            if (retval.toUInt32() === 0) {
              return;
            }

            this.ctx.retval = retval;
            this.ctx.original = Agent.readString(this.ctx.buffer, hook.wide);
            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
