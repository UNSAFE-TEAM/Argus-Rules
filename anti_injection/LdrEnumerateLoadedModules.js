(() => {
  const Agent = globalThis.AgentV1;
  const TAG = "anti_injection";
  const MODULE_NAME = "ntdll.dll";
  const API_NAME = "LdrEnumerateLoadedModules";

  const LDR_DATA_TABLE_ENTRY_OFFSETS = {
    x86: {
      fullDllName: 0x24,
    },
    x64: {
      fullDllName: 0x48,
    },
  };

  let originalCallback = null;
  const HIDDEN_KEYWORDS = ["frida", "gum", "argus"];

  function offsets() {
    return Process.pointerSize === 8
      ? LDR_DATA_TABLE_ENTRY_OFFSETS.x64
      : LDR_DATA_TABLE_ENTRY_OFFSETS.x86;
  }

  function readFullDllName(ldrEntry) {
    if (!ldrEntry || ldrEntry.isNull()) {
      return "";
    }

    return Agent.readUnicodeString(ldrEntry.add(offsets().fullDllName));
  }

  function shouldHidePath(path) {
    return Agent.containsAny(path, HIDDEN_KEYWORDS);
  }

  function install() {
    Agent.attachApi(TAG, MODULE_NAME, API_NAME, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.originalCallback = args[1];
        this.hidden = [];
        originalCallback = new NativeFunction(this.originalCallback, "void", [
          "pointer",
          "pointer",
          "pointer",
        ]);

        const state = this;

        this.filteredCallback = new NativeCallback(
          (ldrEntry, parameter, stop) => {
            const path = readFullDllName(ldrEntry);

            if (shouldHidePath(path)) {
              state.hidden.push(path);
              return;
            }

            originalCallback(ldrEntry, parameter, stop);
          },
          "void",
          ["pointer", "pointer", "pointer"],
        );

        args[1] = this.filteredCallback;
      },

      onLeave(_retval) {
        if (this.hidden.length === 0) {
          return;
        }

        Agent.collect(
          TAG,
          MODULE_NAME,
          API_NAME,
          this.caller.toString(),
          [],
          [],
        );

        Agent.triggered(TAG, MODULE_NAME, API_NAME, this.caller.toString(), {
          original: { hidden: this.hidden.join(",") },
          current: { hidden: String(this.hidden.length) },
        });
      },
    }));
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded(MODULE_NAME, install);
  });
})();
