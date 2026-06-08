(() => {
  const Agent = globalThis.AgentV1;
  const TAG = "anti_debug";
  const MODULE_NAME = "peb";
  const API_NAME = "BeingDebugged";
  const FIELD_OFFSET = 0x2;

  function getPebPointer() {
    const rtlGetCurrentPeb = Agent.getExport("ntdll.dll", "RtlGetCurrentPeb");
    if (!rtlGetCurrentPeb) {
      return null;
    }

    const fn = new NativeFunction(rtlGetCurrentPeb, "pointer", []);
    return fn();
  }

  Agent.safeCall("anti_debug.peb.being_debugged", () => {
    const peb = getPebPointer();
    if (!peb || peb.isNull()) {
      return;
    }

    const field = peb.add(FIELD_OFFSET);
    const original = field.readU8();

    field.writeU8(0);

    Agent.triggered(TAG, MODULE_NAME, API_NAME, field.toString(), {
      original: { value: String(original) },
      current: { value: "0" },
    });
  });
})();
