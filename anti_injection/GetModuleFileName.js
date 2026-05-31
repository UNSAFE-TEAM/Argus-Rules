(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "anti_injection";
  const FAKE_MODULE_PATH = "C:\\Windows\\System32\\version.dll";

  const HIDDEN_KEYWORDS = ["frida", "gum", "argus"];

  function shouldHidePath(path) {
    return Agent.containsAny(path, HIDDEN_KEYWORDS);
  }

  ArgusSensors.use("kernel32.GetModuleFileName", {
    name: "anti_injection.module_file_name",
    match(ctx) {
      return shouldHidePath(ctx.original);
    },
    apply(ctx) {
      ctx.replaceString(FAKE_MODULE_PATH);

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { module: ctx.original },
        current: { module: FAKE_MODULE_PATH },
      });
    },
  });
})();
