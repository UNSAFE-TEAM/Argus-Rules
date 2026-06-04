(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "ThreadInjection";
  const TAG = "sensor";

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of [
      { moduleName: "kernel32.dll", apiName: "CreateRemoteThread", ex: false },
      { moduleName: "kernel32.dll", apiName: "CreateRemoteThreadEx", ex: true },
    ]) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              caller: this.returnAddress.toString(),
              processHandle: args[0],
              startAddress: args[3],
              parameter: args[4],
              creationFlags: args[5].toUInt32(),
              threadIdPointer: args[hook.ex ? 7 : 6],
              threadId: "",
              threadHandle: null,
            };
          },

          onLeave(retval) {
            this.ctx.threadHandle = retval;

            try {
              if (this.ctx.threadIdPointer && !this.ctx.threadIdPointer.isNull()) {
                this.ctx.threadId = String(this.ctx.threadIdPointer.readU32());
              }
            } catch (_) {
            }

            if (!retval.isNull()) {
              sensor.emit(this.ctx);
            }
          },
        }));
      });
    }

    Agent.whenModuleLoaded("kernel32.dll", () => {
      Agent.attachApi(TAG, "kernel32.dll", "QueueUserAPC", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "kernel32.dll",
            apiName: "QueueUserAPC",
            caller: this.returnAddress.toString(),
            apcRoutine: args[0],
            threadHandle: args[1],
            data: args[2],
          };
        },

        onLeave(retval) {
          if (retval.toInt32() !== 0) {
            sensor.emit(this.ctx);
          }
        },
      }));

      Agent.attachApi(TAG, "kernel32.dll", "SetThreadContext", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "kernel32.dll",
            apiName: "SetThreadContext",
            caller: this.returnAddress.toString(),
            threadHandle: args[0],
            context: args[1],
          };
        },

        onLeave(retval) {
          if (retval.toInt32() !== 0) {
            sensor.emit(this.ctx);
          }
        },
      }));

      Agent.attachApi(TAG, "kernel32.dll", "ResumeThread", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "kernel32.dll",
            apiName: "ResumeThread",
            caller: this.returnAddress.toString(),
            threadHandle: args[0],
          };
        },

        onLeave(retval) {
          if (retval.toInt32() !== -1) {
            sensor.emit(this.ctx);
          }
        },
      }));
    });
  });
})();
