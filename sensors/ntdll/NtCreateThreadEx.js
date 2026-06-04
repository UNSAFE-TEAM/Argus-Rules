(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "NtCreateThreadEx";
  const TAG = "sensor";

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded("ntdll.dll", () => {
      Agent.attachApi(TAG, "ntdll.dll", "NtCreateThreadEx", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "ntdll.dll",
            apiName: "NtCreateThreadEx",
            caller: this.returnAddress.toString(),
            threadHandlePointer: args[0],
            desiredAccess: args[1].toUInt32(),
            processHandle: args[3],
            startAddress: args[4],
            parameter: args[5],
            createFlags: args[6].toUInt32(),
            threadHandle: null,
          };
        },

        onLeave(retval) {
          if (retval.toInt32() !== 0) {
            return;
          }

          try {
            if (this.ctx.threadHandlePointer && !this.ctx.threadHandlePointer.isNull()) {
              this.ctx.threadHandle = this.ctx.threadHandlePointer.readPointer();
            }
          } catch (_) {
          }

          sensor.emit(this.ctx);
        },
      }));
    });
  });
})();
