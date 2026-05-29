(() => {
  const TAG = "anti_sandbox";
  const MODULE_NAME = "kernel32.dll";
  const API_NAME = "GlobalMemoryStatusEx";

  const TOTAL_PHYSICAL = new UInt64("17179869184");
  const AVAILABLE_PHYSICAL = new UInt64("12884901888");

  const OFFSET_MEMORY_LOAD = 4;
  const OFFSET_TOTAL_PHYS = 8;
  const OFFSET_AVAIL_PHYS = 16;

  function install() {
    Agent.attachApi(TAG, MODULE_NAME, API_NAME, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.status = args[0];
      },

      onLeave(retval) {
        if (retval.toInt32() === 0 || !this.status || this.status.isNull()) {
          return;
        }

        const totalPhys = this.status.add(OFFSET_TOTAL_PHYS);
        const availPhys = this.status.add(OFFSET_AVAIL_PHYS);
        const memoryLoad = this.status.add(OFFSET_MEMORY_LOAD);
        const original = totalPhys.readU64();

        totalPhys.writeU64(TOTAL_PHYSICAL);
        availPhys.writeU64(AVAILABLE_PHYSICAL);
        memoryLoad.writeU32(25);

        Agent.collect(TAG, MODULE_NAME, API_NAME, this.caller.toString(), [], []);
        Agent.triggered(TAG, MODULE_NAME, API_NAME, this.caller.toString(), {
          original: { totalPhysical: original.toString() },
          current: { totalPhysical: TOTAL_PHYSICAL.toString() },
        });
      },
    }));
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded(MODULE_NAME, install);
  });
})();
