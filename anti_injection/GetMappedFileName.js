(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "anti_injection";
  const DOS_FAKE_PATH = "C:\\Windows\\System32\\version.dll";
  const NT_FAKE_SUFFIX = "\\Windows\\System32\\version.dll";

  const HIDDEN_KEYWORDS = ["frida", "gum", "argus"];

  function shouldHidePath(path) {
    return Agent.containsAny(path, HIDDEN_KEYWORDS);
  }

  function fakePath(original) {
    const match = String(original || "").match(/^(\\Device\\HarddiskVolume\d+)/i);

    if (match) {
      return `${match[1]}${NT_FAKE_SUFFIX}`;
    }

    return DOS_FAKE_PATH;
  }

  ArgusSensors.use("kernel32.GetMappedFileName", {
    name: "anti_injection.mapped_file_name",
    match(ctx) {
      return shouldHidePath(ctx.original);
    },
    apply(ctx) {
      const current = fakePath(ctx.original);
      ctx.replaceString(current);

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { module: ctx.original },
        current: { module: current },
      });
    },
  });
})();
