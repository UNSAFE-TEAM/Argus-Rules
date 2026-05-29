(() => {
  const TAG = "anti_sandbox";
  const ERROR_SUCCESS = 0;
  const ERROR_FILE_NOT_FOUND = 2;
  const ERROR_NO_MORE_ITEMS = 259;

  const HIDDEN_KEYWORDS = ["vmware", "ven_15ad"];
  const VALUE_REPLACEMENTS = {
    systemmanufacturer: "LENOVO",
    systemproductname: "20XWCTO1WW",
    identifier: "Samsung SSD 980 PRO 1TB",
  };

  const API_HOOKS = [
    { apiName: "RegOpenKeyExA", wide: false, hook: hookRegOpenKeyEx },
    { apiName: "RegOpenKeyExW", wide: true, hook: hookRegOpenKeyEx },
    { apiName: "RegQueryValueExA", wide: false, hook: hookRegQueryValueEx },
    { apiName: "RegQueryValueExW", wide: true, hook: hookRegQueryValueEx },
    { apiName: "RegEnumKeyExA", wide: false, hook: hookRegEnumKeyEx },
    { apiName: "RegEnumKeyExW", wide: true, hook: hookRegEnumKeyEx },
  ];

  const keyPaths = {};

  function readSubKey(ptrValue, wide) {
    return Agent.readString(ptrValue, wide);
  }

  function readValueName(ptrValue, wide) {
    return Agent.readString(ptrValue, wide).toLowerCase();
  }

  function shouldHideKey(path) {
    return Agent.containsAny(path, HIDDEN_KEYWORDS);
  }

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

  function hookRegOpenKeyEx(moduleName, apiName, wide) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.subKey = readSubKey(args[1], wide);
        this.resultKey = args[4];
      },

      onLeave(retval) {
        if (shouldHideKey(this.subKey)) {
          retval.replace(ERROR_FILE_NOT_FOUND);

          Agent.collect(TAG, moduleName, apiName, this.caller.toString(), [], []);
          Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
            original: { key: this.subKey },
            current: { key: "hidden" },
          });

          return;
        }

        if (
          retval.toInt32() === ERROR_SUCCESS &&
          this.resultKey &&
          !this.resultKey.isNull()
        ) {
          const key = this.resultKey.readPointer().toString();
          keyPaths[key] = this.subKey;
        }
      },
    }));
  }

  function hookRegQueryValueEx(moduleName, apiName, wide) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.key = args[0].toString();
        this.valueName = readValueName(args[1], wide);
        this.data = args[4];
        this.dataSize = args[5];
      },

      onLeave(retval) {
        if (retval.toInt32() !== ERROR_SUCCESS) {
          return;
        }

        const replacement = VALUE_REPLACEMENTS[this.valueName];

        if (!replacement) {
          return;
        }

        const original = Agent.readString(this.data, wide);

        if (!Agent.containsAny(original, HIDDEN_KEYWORDS)) {
          return;
        }

        if (!writeRegistryString(this.data, this.dataSize, replacement, wide)) {
          return;
        }

        Agent.collect(TAG, moduleName, apiName, this.caller.toString(), [], []);
        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: { [this.valueName]: original },
          current: { [this.valueName]: replacement },
        });
      },
    }));
  }

  function hookRegEnumKeyEx(moduleName, apiName, wide) {
    Agent.attachApi(TAG, moduleName, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress;
        this.name = args[2];
      },

      onLeave(retval) {
        if (retval.toInt32() !== ERROR_SUCCESS) {
          return;
        }

        const original = Agent.readString(this.name, wide);

        if (!shouldHideKey(original)) {
          return;
        }

        retval.replace(ERROR_NO_MORE_ITEMS);

        Agent.collect(TAG, moduleName, apiName, this.caller.toString(), [], []);
        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: { key: original },
          current: { key: "hidden" },
        });
      },
    }));
  }

  function install(moduleName, hook) {
    hook.hook(moduleName, hook.apiName, hook.wide);
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded("advapi32.dll", () => {
      for (const hook of API_HOOKS) {
        install("advapi32.dll", hook);
      }
    });
  });
})();
