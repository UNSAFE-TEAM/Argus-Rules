(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "wininet.Http";
  const TAG = "sensor";

  globalThis.ArgusSensorState = globalThis.ArgusSensorState || {};
  ArgusSensorState.wininet = ArgusSensorState.wininet || {};

  const INTERNET_DEFAULT_HTTPS_PORT = 443;

  function schemeForPort(port) {
    return Number(port) === INTERNET_DEFAULT_HTTPS_PORT ? "https" : "http";
  }

  function joinUrl(connection, path) {
    if (!connection || !path) return "";

    const prefix = `${connection.scheme}://${connection.host}`;
    const port =
      (connection.scheme === "https" && connection.port === INTERNET_DEFAULT_HTTPS_PORT) ||
      (connection.scheme === "http" && connection.port === 80)
        ? ""
        : `:${connection.port}`;

    return `${prefix}${port}${path.startsWith("/") ? path : `/${path}`}`;
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded("wininet.dll", () => {
      Agent.attachApi(TAG, "wininet.dll", "InternetOpenUrlA", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "wininet.dll",
            apiName: "InternetOpenUrlA",
            wide: false,
            caller: this.returnAddress.toString(),
            url: Agent.readAnsi(args[1]),
          };
          if (this.ctx.url) sensor.emit(this.ctx);
        },
      }));

      Agent.attachApi(TAG, "wininet.dll", "InternetOpenUrlW", () => ({
        onEnter(args) {
          this.ctx = {
            sensor: SENSOR_NAME,
            moduleName: "wininet.dll",
            apiName: "InternetOpenUrlW",
            wide: true,
            caller: this.returnAddress.toString(),
            url: Agent.readUtf16(args[1]),
          };
          if (this.ctx.url) sensor.emit(this.ctx);
        },
      }));

      for (const hook of [
        { apiName: "InternetConnectA", wide: false },
        { apiName: "InternetConnectW", wide: true },
      ]) {
        Agent.attachApi(TAG, "wininet.dll", hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: "wininet.dll",
              apiName: hook.apiName,
              wide: hook.wide,
              caller: this.returnAddress.toString(),
              host: Agent.readString(args[1], hook.wide),
              port: args[2].toUInt32(),
              scheme: schemeForPort(args[2].toUInt32()),
              handle: null,
            };
            if (this.ctx.host) {
              sensor.emit(this.ctx);
            }
          },
        }));
      }

      for (const hook of [
        { apiName: "HttpOpenRequestA", wide: false },
        { apiName: "HttpOpenRequestW", wide: true },
      ]) {
        Agent.attachApi(TAG, "wininet.dll", hook.apiName, () => ({
          onEnter(args) {
            const path = Agent.readString(args[2], hook.wide);
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: "wininet.dll",
              apiName: hook.apiName,
              wide: hook.wide,
              caller: this.returnAddress.toString(),
              method: Agent.readString(args[1], hook.wide),
              path,
              url: "",
              handle: null,
            };
            if (this.ctx.path || this.ctx.method) {
              sensor.emit(this.ctx);
            }
          },
        }));
      }

      for (const hook of [
        { apiName: "HttpSendRequestA", wide: false },
        { apiName: "HttpSendRequestW", wide: true },
      ]) {
        Agent.attachApi(TAG, "wininet.dll", hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: "wininet.dll",
              apiName: hook.apiName,
              wide: hook.wide,
              caller: this.returnAddress.toString(),
              url: "",
              headers: Agent.readString(args[1], hook.wide),
            };
            if (this.ctx.url || this.ctx.headers) sensor.emit(this.ctx);
          },
        }));
      }
    });
  });
})();
