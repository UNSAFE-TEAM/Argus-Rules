(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "anti_sandbox";
  const KEYWORDS = [
    "ida",
    "x64dbg",
    "x32dbg",
    "ollydbg",
    "windbg",
    "dnspy",
    "ghidra",
    "wireshark",
    "process hacker",
    "processhacker",
    "procmon",
    "procexp",
    "tcpview",
    "autoruns",
    "vmware",
    "virtualbox",
    "vbox",
    "sandbox",
    "cuckoo",
  ];

  function suspicious(...values) {
    for (const value of values) {
      if (Agent.containsAny(value, KEYWORDS)) {
        return true;
      }
    }

    return false;
  }

  ArgusSensors.use("user32.WindowProbe", {
    name: "anti_sandbox.window_probe",
    match(ctx) {
      return suspicious(ctx.className, ctx.windowName, ctx.text);
    },
    apply(ctx) {
      const original = {
        className: ctx.className || "",
        windowName: ctx.windowName || "",
        text: ctx.text || "",
        result: ctx.result || "",
      };

      let changed = false;

      if (ctx.apiName.startsWith("FindWindow")) {
        changed = ctx.hide();
      } else {
        changed = ctx.clearText();
      }

      if (!changed) {
        return;
      }

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original,
        current: {
          className: ctx.className || "",
          windowName: ctx.windowName || "",
          text: ctx.text || "",
          result: ctx.result || "",
        },
      });
    },
  });
})();
