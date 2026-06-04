(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "behavior";

  function emit(ctx, action, network) {
    Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
      action,
      network,
    });
  }

  ArgusSensors.use("ws2_32.NameResolution", {
    name: "behavior.network.name_resolution",
    match(ctx) {
      return !!ctx.host;
    },
    apply(ctx) {
      emit(ctx, "dns_query", {
        host: ctx.host,
        service: ctx.service,
      });
    },
  });

  ArgusSensors.use("dnsapi.DnsQuery", {
    name: "behavior.network.dns_query",
    match(ctx) {
      return !!ctx.query;
    },
    apply(ctx) {
      emit(ctx, "dns_query", {
        query: ctx.query,
        queryType: String(ctx.queryType),
      });
    },
  });

  ArgusSensors.use("ws2_32.Connect", {
    name: "behavior.network.connect",
    match(ctx) {
      return !!ctx.address;
    },
    apply(ctx) {
      emit(ctx, "network_connect", {
        family: ctx.family,
        address: ctx.address,
        port: ctx.port,
      });
    },
  });

  ArgusSensors.use("ws2_32.DatagramTarget", {
    name: "behavior.network.datagram_target",
    match(ctx) {
      return !!ctx.address;
    },
    apply(ctx) {
      emit(ctx, "network_connect", {
        family: ctx.family,
        address: ctx.address,
        port: ctx.port,
      });
    },
  });

  ArgusSensors.use("mswsock.ConnectEx", {
    name: "behavior.network.connect_ex",
    match(ctx) {
      return !!ctx.address;
    },
    apply(ctx) {
      emit(ctx, "network_connect", {
        family: ctx.family,
        address: ctx.address,
        port: ctx.port,
      });
    },
  });

  ArgusSensors.use("wininet.Http", {
    name: "behavior.network.wininet_http",
    match(ctx) {
      return !!(ctx.url || ctx.host);
    },
    apply(ctx) {
      emit(ctx, "http_request", {
        url: ctx.url,
        host: ctx.host || "",
        port: ctx.port ? String(ctx.port) : "",
        method: ctx.method || "",
        path: ctx.path || "",
      });
    },
  });

  ArgusSensors.use("urlmon.UrlOpen", {
    name: "behavior.network.urlmon_url",
    match(ctx) {
      return !!ctx.url;
    },
    apply(ctx) {
      emit(ctx, "http_request", {
        url: ctx.url,
        host: "",
        port: "",
        method: "",
        path: "",
      });
    },
  });

  ArgusSensors.use("winhttp.Http", {
    name: "behavior.network.winhttp_http",
    match(ctx) {
      return !!(ctx.url || ctx.host || ctx.event);
    },
    apply(ctx) {
      if (ctx.event === "session") {
        emit(ctx, "http_session", {
          api: ctx.apiName,
          userAgent: ctx.userAgent || "",
          accessType: String(ctx.accessType),
          proxy: ctx.proxy || "",
          proxyBypass: ctx.proxyBypass || "",
          flags: String(ctx.flags),
        });
        return;
      }

      if (ctx.event === "callback") {
        emit(ctx, "http_callback", {
          api: ctx.apiName,
          callback: ctx.callback || "",
          flags: String(ctx.flags),
        });
        return;
      }

      if (ctx.event === "close") {
        emit(ctx, "http_close", {
          api: ctx.apiName,
          handle: ctx.handle ? ctx.handle.toString() : "",
        });
        return;
      }

      emit(ctx, "http_request", {
        url: ctx.url,
        host: ctx.host || "",
        port: ctx.port ? String(ctx.port) : "",
        method: ctx.method || "",
        path: ctx.path || "",
      });
    },
  });
})();
