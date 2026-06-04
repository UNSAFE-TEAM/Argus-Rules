(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "user32.WindowProbe";
  const TAG = "sensor";

  function writeEmptyString(buffer, wide) {
    if (!buffer || buffer.isNull()) return false;

    try {
      if (wide) {
        buffer.writeU16(0);
      } else {
        buffer.writeU8(0);
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded("user32.dll", () => {
      for (const hook of [
        { apiName: "FindWindowA", wide: false, classIndex: 0, windowIndex: 1 },
        { apiName: "FindWindowW", wide: true, classIndex: 0, windowIndex: 1 },
        { apiName: "FindWindowExA", wide: false, classIndex: 2, windowIndex: 3 },
        { apiName: "FindWindowExW", wide: true, classIndex: 2, windowIndex: 3 },
      ]) {
        Agent.attachApi(TAG, "user32.dll", hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: "user32.dll",
              apiName: hook.apiName,
              caller: this.returnAddress.toString(),
              className: Agent.readString(args[hook.classIndex], hook.wide),
              windowName: Agent.readString(args[hook.windowIndex], hook.wide),
              result: "",
              hide() {
                if (!this.retval) return false;

                this.retval.replace(ptr(0));
                this.result = "0x0";
                return true;
              },
            };
          },

          onLeave(retval) {
            this.ctx.retval = retval;
            this.ctx.result = retval.toString();

            if (this.ctx.className || this.ctx.windowName || !retval.isNull()) {
              sensor.emit(this.ctx);
            }
          },
        }));
      }

      for (const hook of [
        { apiName: "GetWindowTextA", wide: false },
        { apiName: "GetWindowTextW", wide: true },
        { apiName: "GetClassNameA", wide: false },
        { apiName: "GetClassNameW", wide: true },
      ]) {
        Agent.attachApi(TAG, "user32.dll", hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: "user32.dll",
              apiName: hook.apiName,
              caller: this.returnAddress.toString(),
              hwnd: args[0],
              buffer: args[1],
              maxChars: args[2].toInt32(),
              text: "",
              clearText() {
                if (!writeEmptyString(this.buffer, hook.wide)) return false;

                if (this.retval) {
                  this.retval.replace(0);
                }

                this.text = "";
                return true;
              },
            };
          },

          onLeave(retval) {
            if (
              retval.toInt32() <= 0 ||
              !this.ctx.buffer ||
              this.ctx.buffer.isNull()
            ) {
              return;
            }

            this.ctx.retval = retval;
            this.ctx.text = Agent.readString(this.ctx.buffer, hook.wide);

            if (this.ctx.text) {
              sensor.emit(this.ctx);
            }
          },
        }));
      }
    });
  });
})();
