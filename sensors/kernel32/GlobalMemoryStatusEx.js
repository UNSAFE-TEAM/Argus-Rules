(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "GlobalMemoryStatusEx";
  const TAG = "sensor";
  const MODULE_NAME = "kernel32.dll";
  const API_NAME = "GlobalMemoryStatusEx";

  const OFFSET_MEMORY_LOAD = 4;
  const OFFSET_TOTAL_PHYS = 8;
  const OFFSET_AVAIL_PHYS = 16;

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded(MODULE_NAME, () => {
      Agent.attachApi(TAG, MODULE_NAME, API_NAME, () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: MODULE_NAME,
            apiName: API_NAME,
            caller: this.returnAddress.toString(),
            status: args[0],
            memoryLoad: null,
            totalPhys: null,
            availPhys: null,
            action: null,

            setPhysicalMemory(totalPhys, availPhys, memoryLoad = null) {
              if (!this.status || this.status.isNull()) {
                return false;
              }

              this.status.add(OFFSET_TOTAL_PHYS).writeU64(totalPhys);
              this.status.add(OFFSET_AVAIL_PHYS).writeU64(availPhys);

              if (memoryLoad !== null) {
                this.status.add(OFFSET_MEMORY_LOAD).writeU32(memoryLoad);
              }

              this.currentTotalPhys = totalPhys.toString();
              this.currentAvailPhys = availPhys.toString();
              this.action = "set_physical_memory";
              return true;
            },
          };
        },

        onLeave(retval) {
          const ctx = this.ctx;

          if (retval.toInt32() === 0 || !ctx.status || ctx.status.isNull()) {
            return;
          }

          ctx.memoryLoad = ctx.status.add(OFFSET_MEMORY_LOAD).readU32();
          ctx.totalPhys = ctx.status.add(OFFSET_TOTAL_PHYS).readU64().toString();
          ctx.availPhys = ctx.status.add(OFFSET_AVAIL_PHYS).readU64().toString();
          sensor.emit(ctx);
        },
      }));
    });
  });
})();
