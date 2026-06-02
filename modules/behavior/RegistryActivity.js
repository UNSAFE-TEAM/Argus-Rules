(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "behavior";

  const REG_WININET_NOISE_VALUE_NAMES = [
    "ProxyBypass",
    "IntranetName",
    "UNCAsIntranet",
    "AutoDetect",
    "CachePrefix",
  ];

  const REG_WININET_NOISE_KEY_PATTERNS = [
    /\\software\\microsoft\\windows\\currentversion\\internet settings(\\|$)/i,
    /\\software\\microsoft\\windows\\currentversion\\internet settings\\zonemap(\\|$)/i,
    /\\software\\microsoft\\windows\\currentversion\\internet settings\\zonemap\\protocoldefaults(\\|$)/i,
  ];

  const REG_HIGH_VALUE_KEY_PATTERNS = [
    /\\software\\microsoft\\windows\\currentversion\\run(once)?(\\|$)/i,
    /\\software\\microsoft\\windows\\currentversion\\policies\\explorer\\run(\\|$)/i,
    /\\software\\microsoft\\windows nt\\currentversion\\winlogon(\\|$)/i,
    /\\software\\microsoft\\windows nt\\currentversion\\image file execution options(\\|$)/i,
    /\\software\\microsoft\\windows nt\\currentversion\\windows(\\|$)/i,
    /\\system\\currentcontrolset\\services(\\|$)/i,
    /\\software\\microsoft\\windows\\currentversion\\explorer\\shell folders(\\|$)/i,
    /\\software\\microsoft\\windows\\currentversion\\explorer\\user shell folders(\\|$)/i,
  ];

  function normRegPath(value) {
    return String(value || "")
      .replaceAll("/", "\\")
      .replace(/\\+/g, "\\")
      .toLowerCase();
  }

  function fullRegPath(ctx) {
    return [ctx.keyPath, ctx.subKey].filter(Boolean).join("\\");
  }

  function matchesAnyRegPath(keyPath, patterns) {
    const normalized = `\\${normRegPath(keyPath)}`;
    return patterns.some((pattern) => pattern.test(normalized));
  }

  function isHighValueRegistryPath(keyPath) {
    return matchesAnyRegPath(keyPath, REG_HIGH_VALUE_KEY_PATTERNS);
  }

  function isWininetNoiseRegistryPath(keyPath) {
    return matchesAnyRegPath(keyPath, REG_WININET_NOISE_KEY_PATTERNS);
  }

  function isLikelyWininetRegistryNoise(ctx) {
    const keyPath = fullRegPath(ctx);
    const valueName = String(ctx.valueName || "");

    if (!keyPath) {
      return false;
    }

    if (isHighValueRegistryPath(keyPath)) {
      return false;
    }

    return (
      REG_WININET_NOISE_VALUE_NAMES.includes(valueName) &&
      isWininetNoiseRegistryPath(keyPath)
    );
  }

  function emit(ctx, action, registry) {
    Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
      action,
      registry,
    });
  }

  ArgusSensors.use("RegSetValueEx", {
    name: "behavior.registry.set_value",
    match(ctx) {
      return !!(ctx.keyPath || ctx.valueName) && !isLikelyWininetRegistryNoise(ctx);
    },
    apply(ctx) {
      emit(ctx, "registry_set_value", {
        keyPath: ctx.keyPath,
        valueName: ctx.valueName,
        type: String(ctx.type),
        dataSize: String(ctx.dataSize),
      });
    },
  });

  ArgusSensors.use("RegOpenKeyEx", {
    name: "behavior.registry.track_open_key",
    match() {
      return false;
    },
  });

  ArgusSensors.use("RegCreateKeyEx", {
    name: "behavior.registry.track_create_key",
    match() {
      return false;
    },
  });

  ArgusSensors.use("RegDeleteValue", {
    name: "behavior.registry.delete_value",
    match(ctx) {
      return !!(ctx.keyPath || ctx.valueName);
    },
    apply(ctx) {
      emit(ctx, "registry_delete_value", {
        keyPath: ctx.keyPath,
        valueName: ctx.valueName,
      });
    },
  });

  ArgusSensors.use("RegDeleteKey", {
    name: "behavior.registry.delete_key",
    match(ctx) {
      return !!ctx.subKey;
    },
    apply(ctx) {
      emit(ctx, "registry_delete_key", { subKey: ctx.subKey });
    },
  });

  ArgusSensors.use("RegDeleteTree", {
    name: "behavior.registry.delete_tree",
    match(ctx) {
      return !!ctx.subKey;
    },
    apply(ctx) {
      emit(ctx, "registry_delete_tree", { subKey: ctx.subKey });
    },
  });

  ArgusSensors.use("RegRenameKey", {
    name: "behavior.registry.rename_key",
    match(ctx) {
      return !!ctx.newName;
    },
    apply(ctx) {
      emit(ctx, "registry_rename_key", {
        subKey: ctx.subKey,
        newName: ctx.newName,
      });
    },
  });
})();
