(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "profile_vmware";

  const HIDDEN_FILES = [
    "vmnet.sys",
    "vmmouse.sys",
    "vmusb.sys",
    "vm3dmp.sys",
    "vmci.sys",
    "vmhgfs.sys",
    "vmmemctl.sys",
    "vmx86.sys",
    "vmrawdsk.sys",
    "vmusbmouse.sys",
    "vmkdb.sys",
    "vmnetuserif.sys",
    "vmnetadapter.sys",
  ];
  const HIDDEN_DIRECTORIES = ["\\vmware\\"];

  function shouldHideFile(path) {
    const normalized = String(path || "").toLowerCase().replaceAll("/", "\\");

    if (
      normalized.includes("\\system32\\drivers\\") &&
      Agent.containsAny(normalized, HIDDEN_FILES)
    ) {
      return true;
    }

    return Agent.containsAny(normalized, HIDDEN_DIRECTORIES);
  }

  ArgusSensors.use("GetFileAttributes", {
    name: "vmware.file_artifact.attributes",
    match(ctx) {
      return shouldHideFile(ctx.path);
    },
    apply(ctx) {
      ctx.notFound();

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { file: ctx.path },
        current: { file: "hidden" },
      });
    },
  });
})();
