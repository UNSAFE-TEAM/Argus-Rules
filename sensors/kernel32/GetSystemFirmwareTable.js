(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "GetSystemFirmwareTable";
  const TAG = "sensor";

  const API_HOOKS = [
    { moduleName: "kernel32.dll", apiName: "GetSystemFirmwareTable" },
    { moduleName: "kernelbase.dll", apiName: "GetSystemFirmwareTable" },
  ];

  function signatureName(value) {
    return String.fromCharCode(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            const provider = args[0].toUInt32();
            const tableId = args[1].toUInt32();

            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              caller: this.returnAddress.toString(),
              provider,
              providerName: signatureName(provider),
              tableId,
              tableName: signatureName(tableId),
              buffer: args[2],
              bufferSize: args[3].toUInt32(),
              returnedSize: 0,
              patches: [],
              action: null,

              patchAscii(original, current) {
                if (
                  !this.buffer ||
                  this.buffer.isNull() ||
                  this.returnedSize <= 0 ||
                  original.length !== current.length
                ) {
                  return 0;
                }

                const needle = [];
                const replacement = [];

                for (let i = 0; i < original.length; i++) {
                  needle.push(original.charCodeAt(i) & 0xff);
                  replacement.push(current.charCodeAt(i) & 0xff);
                }

                let count = 0;
                const limit = Math.min(this.returnedSize, this.bufferSize);

                for (let offset = 0; offset <= limit - needle.length; offset++) {
                  let matched = true;

                  for (let i = 0; i < needle.length; i++) {
                    if (this.buffer.add(offset + i).readU8() !== needle[i]) {
                      matched = false;
                      break;
                    }
                  }

                  if (!matched) {
                    continue;
                  }

                  for (let i = 0; i < replacement.length; i++) {
                    this.buffer.add(offset + i).writeU8(replacement[i]);
                  }

                  this.patches.push({ original, current, offset });
                  this.action = "patch_ascii";
                  count++;
                }

                return count;
              },
            };
          },

          onLeave(retval) {
            const ctx = this.ctx;
            ctx.returnedSize = retval.toUInt32();

            if (ctx.returnedSize === 0 || !ctx.buffer || ctx.buffer.isNull()) {
              return;
            }

            sensor.emit(ctx);
          },
        }));
      });
    }
  });
})();
