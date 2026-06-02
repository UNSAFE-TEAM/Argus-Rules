(() => {
  globalThis.ArgusRegistryPathV1 = globalThis.ArgusRegistryPathV1 || {
    rootNames: {
      "0x80000000": "HKEY_CLASSES_ROOT",
      "0x80000001": "HKEY_CURRENT_USER",
      "0x80000002": "HKEY_LOCAL_MACHINE",
      "0x80000003": "HKEY_USERS",
      "0x80000005": "HKEY_CURRENT_CONFIG",
      "0xffffffff80000000": "HKEY_CLASSES_ROOT",
      "0xffffffff80000001": "HKEY_CURRENT_USER",
      "0xffffffff80000002": "HKEY_LOCAL_MACHINE",
      "0xffffffff80000003": "HKEY_USERS",
      "0xffffffff80000005": "HKEY_CURRENT_CONFIG",
    },

    normalize(path) {
      return String(path || "")
        .replaceAll("/", "\\")
        .replace(/\\+/g, "\\")
        .replace(/^\\+|\\+$/g, "");
    },

    join(parent, child) {
      const items = [parent, child]
        .map((item) => this.normalize(item))
        .filter(Boolean);
      return items.join("\\");
    },

    keyName(handle, registryKeys) {
      const key = handle ? handle.toString().toLowerCase() : "";
      return registryKeys[key] || this.rootNames[key] || "";
    },
  };
})();
