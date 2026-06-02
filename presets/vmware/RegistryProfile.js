(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "preset_vmware";

  const HIDDEN_KEYWORDS = ["vmware", "ven_15ad"];
  const VALUE_REPLACEMENTS = {
    systemmanufacturer: "LENOVO",
    systemproductname: "20XWCTO1WW",
    identifier: "Samsung SSD 980 PRO 1TB",
  };

  function shouldHideKey(path) {
    return Agent.containsAny(path, HIDDEN_KEYWORDS);
  }

  ArgusSensors.use("RegOpenKeyEx", {
    name: "vmware.registry.open_key",
    match(ctx) {
      return shouldHideKey(ctx.subKey);
    },
    apply(ctx) {
      ctx.hide();

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { key: ctx.subKey },
        current: { key: "hidden" },
      });
    },
  });

  ArgusSensors.use("RegQueryValueEx", {
    name: "vmware.registry.query_value",
    match(ctx) {
      const replacement = VALUE_REPLACEMENTS[ctx.valueName];
      return (
        !!replacement && Agent.containsAny(ctx.originalValue, HIDDEN_KEYWORDS)
      );
    },
    apply(ctx) {
      const replacement = VALUE_REPLACEMENTS[ctx.valueName];

      if (!ctx.replaceString(replacement)) {
        return;
      }

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { [ctx.valueName]: ctx.originalValue },
        current: { [ctx.valueName]: replacement },
      });
    },
  });

  ArgusSensors.use("RegEnumKeyEx", {
    name: "vmware.registry.enum_key",
    match(ctx) {
      return shouldHideKey(ctx.originalName);
    },
    apply(ctx) {
      ctx.stopEnumeration();

      Agent.collect(TAG, ctx.moduleName, ctx.apiName, ctx.caller, [], []);
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        original: { key: ctx.originalName },
        current: { key: "hidden" },
      });
    },
  });
})();
