(() => {
  const TAG = "anti_sandbox";
  const MODULE_NAME = "iphlpapi.dll";
  const API_NAME = "GetAdaptersInfo";
  const ERROR_SUCCESS = 0;

  const BLOCKED_OUIS = [
    { vendor: "vmware", original: [0x00, 0x05, 0x69], current: [0x00, 0xe0, 0x4c] },
    { vendor: "vmware", original: [0x00, 0x0c, 0x29], current: [0x00, 0xe0, 0x4c] },
    { vendor: "vmware", original: [0x00, 0x1c, 0x14], current: [0x00, 0xe0, 0x4c] },
    { vendor: "vmware", original: [0x00, 0x50, 0x56], current: [0x00, 0xe0, 0x4c] },
  ];

  function macOffset() {
    return Process.pointerSize === 8 ? 408 : 404;
  }

  function nextOffset() {
    return 0;
  }

  function readOui(adapter) {
    const address = adapter.add(macOffset());

    return [address.readU8(), address.add(1).readU8(), address.add(2).readU8()];
  }

  function writeOui(adapter, oui) {
    const address = adapter.add(macOffset());

    address.writeU8(oui[0]);
    address.add(1).writeU8(oui[1]);
    address.add(2).writeU8(oui[2]);
  }

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

  function patchAdapters(firstAdapter, state) {
    let adapter = firstAdapter;

    while (adapter && !adapter.isNull()) {
      const original = readOui(adapter);
      const match = findBlockedOui(original);

      if (match) {
        writeOui(adapter, match.current);
        state.patched.push({
          vendor: match.vendor,
          original: formatOui(original),
          current: formatOui(match.current),
        });
      }

      adapter = adapter.add(nextOffset()).readPointer();
    }
  }

  function install() {
    Agent.attachApi(TAG, MODULE_NAME, API_NAME, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.adapters = args[0];
        this.patched = [];
      },

      onLeave(retval) {
        const status = retval.toInt32();

        if (
          status !== ERROR_SUCCESS ||
          !this.adapters ||
          this.adapters.isNull()
        ) {
          return;
        }

        patchAdapters(this.adapters, this);

        if (this.patched.length === 0) {
          return;
        }

        Agent.collect(TAG, MODULE_NAME, API_NAME, this.caller.toString(), [], []);
        Agent.triggered(TAG, MODULE_NAME, API_NAME, this.caller.toString(), {
          original: {
            oui: this.patched.map((item) => `${item.vendor}:${item.original}`).join(","),
          },
          current: {
            oui: this.patched.map((item) => item.current).join(","),
          },
        });
      },
    }));
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded(MODULE_NAME, install);
  });
})();
