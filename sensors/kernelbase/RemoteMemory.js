(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RemoteMemory";
  const TAG = "sensor";

  const ALLOC_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "VirtualAllocEx" },
    { moduleName: "kernelbase.dll", apiName: "VirtualAllocEx" },
  ];
  const WRITE_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "WriteProcessMemory" },
    { moduleName: "kernelbase.dll", apiName: "WriteProcessMemory" },
  ];
  const PROTECT_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "VirtualProtectEx" },
    { moduleName: "kernelbase.dll", apiName: "VirtualProtectEx" },
  ];

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of ALLOC_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              caller: this.returnAddress.toString(),
              processHandle: args[0],
              requestedAddress: args[1],
              size: args[2],
              allocationType: args[3].toUInt32(),
              protect: args[4].toUInt32(),
              address: null,
            };
          },

          onLeave(retval) {
            this.ctx.address = retval;
            if (!retval.isNull()) {
              sensor.emit(this.ctx);
            }
          },
        }));
      });
    }

    for (const hook of WRITE_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              caller: this.returnAddress.toString(),
              processHandle: args[0],
              address: args[1],
              buffer: args[2],
              size: args[3],
              bytesWrittenPointer: args[4],
              bytesWritten: "",
            };
          },

          onLeave(retval) {
            if (retval.toInt32() === 0) {
              return;
            }

            try {
              if (this.ctx.bytesWrittenPointer && !this.ctx.bytesWrittenPointer.isNull()) {
                this.ctx.bytesWritten = this.ctx.bytesWrittenPointer.readPointer().toString();
              }
            } catch (_) {
            }

            sensor.emit(this.ctx);
          },
        }));
      });
    }

    for (const hook of PROTECT_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              caller: this.returnAddress.toString(),
              processHandle: args[0],
              address: args[1],
              size: args[2],
              newProtect: args[3].toUInt32(),
              oldProtectPointer: args[4],
              oldProtect: "",
            };
          },

          onLeave(retval) {
            if (retval.toInt32() === 0) {
              return;
            }

            try {
              if (this.ctx.oldProtectPointer && !this.ctx.oldProtectPointer.isNull()) {
                this.ctx.oldProtect = String(this.ctx.oldProtectPointer.readU32());
              }
            } catch (_) {
            }

            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
