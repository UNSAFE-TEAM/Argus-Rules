(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "GetAdaptersInfo";
  const TAG = "sensor";
  const MODULE_NAME = "iphlpapi.dll";
  const API_NAME = "GetAdaptersInfo";
  const ERROR_SUCCESS = 0;

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

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded(MODULE_NAME, () => {
      Agent.attachApi(TAG, MODULE_NAME, API_NAME, () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: MODULE_NAME,
            apiName: API_NAME,
            caller: this.returnAddress.toString(),
            adapters: args[0],
            adaptersSize: args[1],
            adapterItems: [],
            action: null,

            replaceOui(adapter, current) {
              writeOui(adapter, current);
              this.action = "replace_oui";
            },
          };
        },

        onLeave(retval) {
          const ctx = this.ctx;

          if (
            retval.toInt32() !== ERROR_SUCCESS ||
            !ctx.adapters ||
            ctx.adapters.isNull()
          ) {
            return;
          }

          let adapter = ctx.adapters;

          while (adapter && !adapter.isNull()) {
            const oui = readOui(adapter);
            ctx.adapterItems.push({
              adapter,
              oui,
              ouiText: formatOui(oui),
            });

            adapter = adapter.add(nextOffset()).readPointer();
          }

          sensor.emit(ctx);
        },
      }));
    });
  });
})();
