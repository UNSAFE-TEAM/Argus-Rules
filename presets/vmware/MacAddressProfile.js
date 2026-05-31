(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "profile_vmware";

  const BLOCKED_OUIS = [
    { original: [0x00, 0x05, 0x69], current: [0x00, 0xe0, 0x4c] },
    { original: [0x00, 0x0c, 0x29], current: [0x00, 0xe0, 0x4c] },
    { original: [0x00, 0x1c, 0x14], current: [0x00, 0xe0, 0x4c] },
    { original: [0x00, 0x50, 0x56], current: [0x00, 0xe0, 0x4c] },
  ];

  function formatOui(oui) {
    return oui.map((item) => item.toString(16).padStart(2, "0")).join(":");
  }

  function findBlockedOui(oui) {
    return BLOCKED_OUIS.find(
      (item) =>
        item.original[0] === oui[0] &&
        item.original[1] === oui[1] &&
        item.original[2] === oui[2],
    );
  }

  ArgusSensors.use("GetAdaptersInfo", {
    name: "vmware.mac_address.oui",
    match(ctx) {
      return ctx.adapterItems.some((item) => !!findBlockedOui(item.oui));
    },
    apply(ctx) {
      const patched = [];

      for (const item of ctx.adapterItems) {
        const match = findBlockedOui(item.oui);

        if (!match) {
          continue;
        }

        ctx.replaceOui(item.adapter, match.current);
        patched.push({
          original: item.ouiText,
          current: formatOui(match.current),
        });
      }

      if (patched.length === 0) {
        return;
      }

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { oui: patched.map((item) => item.original).join(",") },
        current: { oui: patched.map((item) => item.current).join(",") },
      });
    },
  });
})();
