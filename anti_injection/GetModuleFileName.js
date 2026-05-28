(() => {
  const TAG = "anti_injection";
  const FAKE_MODULE_PATH = "C:\\Windows\\System32\\version.dll";

  const hookedApis = {};

  function shouldHidePath(path) {
    const normalized = String(path || "").toLowerCase();

    return (
      normalized.includes("frida") ||
      normalized.includes("gum") ||
      normalized.includes("argus")
    );
  }

  function readPath(buffer, wide) {
    if (!buffer || buffer.isNull()) {
      return "";
    }

    try {
      return wide ? buffer.readUtf16String() : buffer.readAnsiString();
    } catch (_) {
      return "";
    }
  }

  function writePath(buffer, maxChars, wide) {
    if (!buffer || buffer.isNull() || maxChars <= 0) {
      return 0;
    }

    const path = FAKE_MODULE_PATH.slice(0, Math.max(0, maxChars - 1));

    if (wide) {
      buffer.writeUtf16String(path);
    } else {
      buffer.writeAnsiString(path);
    }

    return path.length;
  }

  function hookGetModuleFileName(moduleName, apiName, wide) {
    const addr = Agent.getExport(moduleName, apiName);

    if (!addr) {
      return;
    }

    Interceptor.attach(addr, {
      onEnter(args) {
        this.caller = this.returnAddress;
        this.buffer = args[1];
        this.size = args[2].toUInt32();
      },

      onLeave(retval) {
        if (retval.toUInt32() === 0) {
          return;
        }

        const original = readPath(this.buffer, wide);

        if (!shouldHidePath(original)) {
          return;
        }

        const written = writePath(this.buffer, this.size, wide);
        retval.replace(written);

        Agent.collect(
          TAG,
          moduleName,
          apiName,
          this.caller.toString(),
          [],
          [],
        );

        Agent.triggered(TAG, moduleName, apiName, this.caller.toString(), {
          original: { module: original },
          current: { module: FAKE_MODULE_PATH },
        });
      },
    });

    Agent.register(TAG, moduleName, apiName);
  }

  function install(moduleName, apiName, wide) {
    const key = `${moduleName}!${apiName}`;

    if (hookedApis[key]) {
      return;
    }

    hookedApis[key] = true;
    hookGetModuleFileName(moduleName, apiName, wide);
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded("kernel32.dll", () => {
      install("kernel32.dll", "GetModuleFileNameA", false);
      install("kernel32.dll", "GetModuleFileNameW", true);
    });

    Agent.whenModuleLoaded("kernelbase.dll", () => {
      install("kernelbase.dll", "GetModuleFileNameA", false);
      install("kernelbase.dll", "GetModuleFileNameW", true);
    });
  });
})();
