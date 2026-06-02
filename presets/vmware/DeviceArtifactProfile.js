(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "preset_vmware";

  const HIDDEN_DEVICES = ["\\\\.\\hgfs", "\\\\.\\vmci"];

  function normalizeDeviceName(path) {
    return String(path || "")
      .toLowerCase()
      .replaceAll("/", "\\");
  }

  ArgusSensors.use("CreateFile", {
    name: "vmware.device_artifact.create_file",
    match(ctx) {
      return HIDDEN_DEVICES.includes(normalizeDeviceName(ctx.path));
    },
    apply(ctx) {
      ctx.fail();

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { device: ctx.path },
        current: { device: "hidden" },
      });
    },
  });
})();
