(() => {
  const TAG = "anti_injection";
  const DOS_FAKE_PATH = "C:\\Windows\\System32\\version.dll";
  const NT_FAKE_SUFFIX = "\\Windows\\System32\\version.dll";

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

  function fakePath(original) {
    const match = String(original || "").match(/^(\\Device\\HarddiskVolume\d+)/i);

    if (match) {
      return `${match[1]}${NT_FAKE_SUFFIX}`;
    }

    return DOS_FAKE_PATH;
  }

  function writePath(buffer, maxChars, wide, value) {
    if (!buffer || buffer.isNull() || maxChars <= 0) {
      return 0;
    }

    const path = value.slice(0, Math.max(0, maxChars - 1));

    if (wide) {
      buffer.writeUtf16String(path);
    } else {
      buffer.writeAnsiString(path);
    }

    return path.length;
  }

  function hookGetMappedFileName(moduleName, apiName, wide) {
    const addr = Agent.getExport(moduleName, apiName);

    if (!addr) {
      return;
    }

    Interceptor.attach(addr, {
      onEnter(args) {
        this.caller = this.returnAddress;
        this.buffer = args[2];
        this.size = args[3].toUInt32();
      },

      onLeave(retval) {
        if (retval.toUInt32() === 0) {
          return;
        }

        const original = readPath(this.buffer, wide);

        if (!shouldHidePath(original)) {
          return;
        }

        const current = fakePath(original);
        const written = writePath(this.buffer, this.size, wide, current);
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
          current: { module: current },
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
    hookGetMappedFileName(moduleName, apiName, wide);
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded("kernel32.dll", () => {
      install("kernel32.dll", "K32GetMappedFileNameA", false);
      install("kernel32.dll", "K32GetMappedFileNameW", true);
    });

    Agent.whenModuleLoaded("psapi.dll", () => {
      install("psapi.dll", "GetMappedFileNameA", false);
      install("psapi.dll", "GetMappedFileNameW", true);
    });
  });
})();
