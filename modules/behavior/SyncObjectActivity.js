(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "behavior";

  const NOISY_PREFIXES = [
    "msft.",
    "local\\sm0:",
    "global\\usermodepowerservice",
  ];

  const NOISY_KEYWORDS = ["\\wilerror_", ":wilerror_"];

  function isNoisyName(name) {
    const normalized = String(name || "").toLowerCase();

    if (!normalized) {
      return true;
    }

    for (const prefix of NOISY_PREFIXES) {
      if (normalized.startsWith(prefix)) {
        return true;
      }
    }

    return (
      Agent.containsAny(normalized, NOISY_KEYWORDS) ||
      normalized.includes("\\zonescachecountermutex") ||
      normalized.includes("\\zoneslockedcachecountermutex")
    );
  }

  ArgusSensors.use("SyncObject", {
    name: "behavior.sync_object",
    match(ctx) {
      if (isNoisyName(ctx.name)) {
        return false;
      }

      if (ctx.action === "open" && ctx.objectType !== "mutex") {
        return false;
      }

      return !!ctx.name;
    },
    apply(ctx) {
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        action: `${ctx.objectType}_${ctx.action}`,
        object: {
          type: ctx.objectType,
          name: ctx.name,
        },
      });
    },
  });
})();
