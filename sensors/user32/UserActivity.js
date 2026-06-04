(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "user32.UserActivity";
  const TAG = "sensor";

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded("user32.dll", () => {
      Agent.attachApi(TAG, "user32.dll", "GetCursorPos", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "user32.dll",
            apiName: "GetCursorPos",
            caller: this.returnAddress.toString(),
            point: args[0],
            x: "",
            y: "",
            setPosition(x, y) {
              if (!this.point || this.point.isNull()) return false;

              try {
                this.point.writeS32(x);
                this.point.add(4).writeS32(y);
                this.x = String(x);
                this.y = String(y);
                return true;
              } catch (_) {
                return false;
              }
            },
          };
        },

        onLeave(retval) {
          if (retval.toInt32() === 0 || !this.ctx.point || this.ctx.point.isNull()) {
            return;
          }

          try {
            this.ctx.x = String(this.ctx.point.readS32());
            this.ctx.y = String(this.ctx.point.add(4).readS32());
          } catch (_) {
          }

          sensor.emit(this.ctx);
        },
      }));

      Agent.attachApi(TAG, "user32.dll", "GetLastInputInfo", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "user32.dll",
            apiName: "GetLastInputInfo",
            caller: this.returnAddress.toString(),
            info: args[0],
            tick: "",
            setLastInputTick(tick) {
              if (!this.info || this.info.isNull()) return false;

              try {
                this.info.add(4).writeU32(tick >>> 0);
                this.tick = String(tick >>> 0);
                return true;
              } catch (_) {
                return false;
              }
            },
          };
        },

        onLeave(retval) {
          if (retval.toInt32() === 0 || !this.ctx.info || this.ctx.info.isNull()) {
            return;
          }

          try {
            this.ctx.tick = String(this.ctx.info.add(4).readU32());
          } catch (_) {
          }

          sensor.emit(this.ctx);
        },
      }));
    });
  });
})();
