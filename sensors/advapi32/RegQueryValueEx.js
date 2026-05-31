(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RegQueryValueEx";
  const TAG = "sensor";
  const ERROR_SUCCESS = 0;

  const API_HOOKS = [
    { moduleName: "advapi32.dll", apiName: "RegQueryValueExA", wide: false },
    { moduleName: "advapi32.dll", apiName: "RegQueryValueExW", wide: true },
  ];

  globalThis.ArgusSensorState = globalThis.ArgusSensorState || {};
  ArgusSensorState.registryKeys = ArgusSensorState.registryKeys || {};

  function writeRegistryString(data, dataSize, value, wide) {
    if (!data || data.isNull() || !dataSize || dataSize.isNull()) {
      return false;
    }

    const maxBytes = dataSize.readU32();
    const maxChars = wide ? Math.floor(maxBytes / 2) : maxBytes;
    const written = Agent.writeString(data, maxChars, value, wide);
    const bytes = wide ? (written + 1) * 2 : written + 1;

    dataSize.writeU32(bytes);
    return true;
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              wide: hook.wide,
              caller: this.returnAddress.toString(),
              keyHandle: args[0],
              keyPath: ArgusSensorState.registryKeys[args[0].toString()] || "",
              valueName: Agent.readString(args[1], hook.wide).toLowerCase(),
              reserved: args[2],
              type: args[3],
              data: args[4],
              dataSize: args[5],
              originalStatus: null,
              currentStatus: null,
              originalValue: "",
              action: null,

              replaceString(value) {
                if (writeRegistryString(this.data, this.dataSize, value, this.wide)) {
                  this.action = "replace_string";
                  this.currentValue = value;
                  return true;
                }

                return false;
              },
            };
          },

          onLeave(retval) {
            const ctx = this.ctx;
            ctx.originalStatus = retval.toInt32();
            ctx.currentStatus = ctx.originalStatus;

            if (ctx.originalStatus === ERROR_SUCCESS) {
              ctx.originalValue = Agent.readString(ctx.data, hook.wide);
            }

            sensor.emit(ctx);
          },
        }));
      });
    }
  });
})();
