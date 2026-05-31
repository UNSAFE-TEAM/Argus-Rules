(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "anti_sandbox";
  const TOTAL_BYTES = new UInt64("549755813888");
  const FREE_BYTES = new UInt64("412316860416");

  ArgusSensors.use("GetDiskFreeSpaceEx", {
    name: "anti_sandbox.disk_space",
    match(ctx) {
      return ctx.totalBytes !== TOTAL_BYTES.toString();
    },
    apply(ctx) {
      const originalTotal = ctx.totalBytes;

      ctx.setDiskSpace(TOTAL_BYTES, FREE_BYTES);

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { totalBytes: originalTotal },
        current: { totalBytes: TOTAL_BYTES.toString() },
      });
    },
  });
})();
