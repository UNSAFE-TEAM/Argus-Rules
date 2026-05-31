(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "anti_sandbox";

  const TOTAL_PHYSICAL = new UInt64("17179869184");
  const AVAILABLE_PHYSICAL = new UInt64("12884901888");

  ArgusSensors.use("GlobalMemoryStatusEx", {
    name: "anti_sandbox.memory_status",
    match(ctx) {
      return ctx.totalPhys !== TOTAL_PHYSICAL.toString();
    },
    apply(ctx) {
      const original = ctx.totalPhys;

      if (!ctx.setPhysicalMemory(TOTAL_PHYSICAL, AVAILABLE_PHYSICAL, 25)) {
        return;
      }

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { totalPhysical: original },
        current: { totalPhysical: TOTAL_PHYSICAL.toString() },
      });
    },
  });
})();
