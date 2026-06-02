(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "RegistryNativeKey";
  const TAG = "sensor";
  const STATUS_SUCCESS = 0;

  const API_HOOKS = [
    {
      moduleName: "ntdll.dll",
      apiName: "NtOpenKey",
      resultKeyIndex: 0,
      objectAttributesIndex: 2,
    },
    {
      moduleName: "ntdll.dll",
      apiName: "NtOpenKeyEx",
      resultKeyIndex: 0,
      objectAttributesIndex: 2,
    },
    {
      moduleName: "ntdll.dll",
      apiName: "NtCreateKey",
      resultKeyIndex: 0,
      objectAttributesIndex: 2,
    },
  ];

  globalThis.ArgusSensorState = globalThis.ArgusSensorState || {};
  ArgusSensorState.registryKeys = ArgusSensorState.registryKeys || {};

  function normalizeNativePath(path) {
    const normalized = ArgusRegistryPathV1.normalize(path);

    if (/^registry\\machine(\\|$)/i.test(normalized)) {
      return normalized.replace(/^registry\\machine/i, "HKEY_LOCAL_MACHINE");
    }

    if (/^registry\\user(\\|$)/i.test(normalized)) {
      return normalized.replace(/^registry\\user/i, "HKEY_USERS");
    }

    return normalized;
  }

  function readUnicodeString(unicodeString) {
    if (!unicodeString || unicodeString.isNull()) {
      return "";
    }

    try {
      const length = unicodeString.readU16();
      const buffer = unicodeString.add(Process.pointerSize).readPointer();

      if (!buffer || buffer.isNull() || length <= 0) {
        return "";
      }

      return buffer.readUtf16String(length / 2);
    } catch (_) {
      return "";
    }
  }

  function readObjectAttributes(objectAttributes) {
    if (!objectAttributes || objectAttributes.isNull()) {
      return { rootKey: ptr(0), objectName: "" };
    }

    try {
      const rootKey = objectAttributes.add(Process.pointerSize).readPointer();
      const objectNamePtr = objectAttributes.add(Process.pointerSize * 2).readPointer();

      return {
        rootKey,
        objectName: readUnicodeString(objectNamePtr),
      };
    } catch (_) {
      return { rootKey: ptr(0), objectName: "" };
    }
  }

  function keyPathFromObjectAttributes(objectAttributes) {
    const attrs = readObjectAttributes(objectAttributes);
    const rootPath = ArgusRegistryPathV1.keyName(
      attrs.rootKey,
      ArgusSensorState.registryKeys,
    );
    const objectName = normalizeNativePath(attrs.objectName);

    return ArgusRegistryPathV1.join(rootPath, objectName);
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              caller: this.returnAddress.toString(),
              keyPath: keyPathFromObjectAttributes(args[hook.objectAttributesIndex]),
              resultKey: args[hook.resultKeyIndex],
            };
            sensor.emit(this.ctx);
          },

          onLeave(retval) {
            const ctx = this.ctx;

            if (
              retval.toInt32() !== STATUS_SUCCESS ||
              !ctx.resultKey ||
              ctx.resultKey.isNull() ||
              !ctx.keyPath
            ) {
              return;
            }

            const handle = ctx.resultKey.readPointer();

            if (!handle.isNull()) {
              ArgusSensorState.registryKeys[handle.toString()] = ctx.keyPath;
            }
          },
        }));
      });
    }
  });
})();
