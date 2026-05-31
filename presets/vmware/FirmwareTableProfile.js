(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "profile_vmware";

  const SIGNATURES = [
    { original: "VMware", current: "LENOVO" },
    { original: "VMWARE", current: "LENOVO" },
  ];

  ArgusSensors.use("GetSystemFirmwareTable", {
    name: "vmware.firmware_table.signatures",
    match(_ctx) {
      return true;
    },
    apply(ctx) {
      const patched = [];

      for (const signature of SIGNATURES) {
        const count = ctx.patchAscii(signature.original, signature.current);

        if (count > 0) {
          patched.push(signature.original);
        }
      }

      if (patched.length === 0) {
        return;
      }

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: {
          provider: ctx.providerName,
          tableId: ctx.tableName,
          signatures: patched.join(","),
        },
        current: { signatures: "patched" },
      });
    },
  });
})();
