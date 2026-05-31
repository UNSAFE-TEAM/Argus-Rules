(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "anti_sandbox";
  const LOGICAL_PROCESSORS = 8;

  ArgusSensors.use("GetSystemInfo", {
    name: "anti_sandbox.processor_count",
    match(ctx) {
      return ctx.numberOfProcessors !== null && ctx.numberOfProcessors !== LOGICAL_PROCESSORS;
    },
    apply(ctx) {
      const original = ctx.numberOfProcessors;

      if (!ctx.setNumberOfProcessors(LOGICAL_PROCESSORS)) {
        return;
      }

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { numberOfProcessors: String(original) },
        current: { numberOfProcessors: String(LOGICAL_PROCESSORS) },
      });
    },
  });
})();
