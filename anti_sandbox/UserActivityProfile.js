(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "anti_sandbox";
  const CURSOR_X = 780;
  const CURSOR_Y = 420;

  function currentTick() {
    if (!currentTick.fn) {
      currentTick.fn = new NativeFunction(
        Agent.mustGetExport("kernel32.dll", "GetTickCount"),
        "uint32",
        [],
      );
    }

    return currentTick.fn();
  }

  ArgusSensors.use("user32.UserActivity", {
    name: "anti_sandbox.user_activity",
    match(ctx) {
      return ctx.apiName === "GetCursorPos" || ctx.apiName === "GetLastInputInfo";
    },
    apply(ctx) {
      if (ctx.apiName === "GetCursorPos") {
        const original = { x: ctx.x, y: ctx.y };

        if (!ctx.setPosition(CURSOR_X, CURSOR_Y)) {
          return;
        }

        Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
        Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
          original,
          current: { x: String(CURSOR_X), y: String(CURSOR_Y) },
        });
        return;
      }

      const original = { tick: ctx.tick };

      const tick = currentTick();

      if (!ctx.setLastInputTick(tick)) {
        return;
      }

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original,
        current: { tick: String(tick) },
      });
    },
  });
})();
