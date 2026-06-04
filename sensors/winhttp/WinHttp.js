(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "winhttp.Http";
  const TAG = "sensor";

  globalThis.ArgusSensorState = globalThis.ArgusSensorState || {};
  ArgusSensorState.winhttp = ArgusSensorState.winhttp || {};

  function joinUrl(connection, path) {
    if (!connection || !path) return "";

    const port =
      (connection.scheme === "https" && connection.port === 443) ||
      (connection.scheme === "http" && connection.port === 80)
        ? ""
        : `:${connection.port}`;

    return `${connection.scheme}://${connection.host}${port}${path.startsWith("/") ? path : `/${path}`}`;
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded("winhttp.dll", () => {
      Agent.attachApi(TAG, "winhttp.dll", "WinHttpOpen", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "winhttp.dll",
            apiName: "WinHttpOpen",
            caller: this.returnAddress.toString(),
            event: "session",
            userAgent: Agent.readUtf16(args[0]),
            accessType: args[1].toUInt32(),
            proxy: Agent.readUtf16(args[2]),
            proxyBypass: Agent.readUtf16(args[3]),
            flags: args[4].toUInt32(),
          };
          sensor.emit(this.ctx);
        },
      }));

      Agent.attachApi(TAG, "winhttp.dll", "WinHttpConnect", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "winhttp.dll",
            apiName: "WinHttpConnect",
            caller: this.returnAddress.toString(),
            host: Agent.readUtf16(args[1]),
            port: args[2].toUInt32(),
            scheme: args[2].toUInt32() === 443 ? "https" : "http",
            handle: null,
          };
          if (this.ctx.host) {
            sensor.emit(this.ctx);
          }
        },
      }));

      Agent.attachApi(TAG, "winhttp.dll", "WinHttpOpenRequest", () => ({
        onEnter(args) {
          const path = Agent.readUtf16(args[2]);
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "winhttp.dll",
            apiName: "WinHttpOpenRequest",
            caller: this.returnAddress.toString(),
            method: Agent.readUtf16(args[1]),
            path,
            url: "",
            handle: null,
          };
          if (this.ctx.path || this.ctx.method) {
            sensor.emit(this.ctx);
          }
        },
      }));

      Agent.attachApi(TAG, "winhttp.dll", "WinHttpSendRequest", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "winhttp.dll",
            apiName: "WinHttpSendRequest",
            caller: this.returnAddress.toString(),
            url: "",
            headers: Agent.readUtf16(args[1]),
          };
          if (this.ctx.url || this.ctx.headers) sensor.emit(this.ctx);
        },
      }));

      Agent.attachApi(TAG, "winhttp.dll", "WinHttpSetStatusCallback", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "winhttp.dll",
            apiName: "WinHttpSetStatusCallback",
            caller: this.returnAddress.toString(),
            event: "callback",
            handle: args[0],
            callback: args[1].toString(),
            flags: args[2].toUInt32(),
          };
          sensor.emit(this.ctx);
        },
      }));

      Agent.attachApi(TAG, "winhttp.dll", "WinHttpCloseHandle", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "winhttp.dll",
            apiName: "WinHttpCloseHandle",
            caller: this.returnAddress.toString(),
            event: "close",
            handle: args[0],
          };
          sensor.emit(this.ctx);
        },
      }));
    });
  });
})();
