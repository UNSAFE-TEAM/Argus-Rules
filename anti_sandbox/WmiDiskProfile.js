(() => {
  const TAG = "anti_sandbox";
  const MODULE_NAME = "ole32.dll";
  const API_NAME = "CoCreateInstance";
  const CLASSES = ["Win32_DiskDrive", "Win32_LogicalDisk"];
  const TOTAL_BYTES = "549755813888";

  const hookedPointers = {};
  const objectClasses = {};

  function isWbemLocatorClsid(clsid) {
    if (!clsid || clsid.isNull()) return false;

    try {
      return (
        Agent.isGuid(clsid, [
          0x11, 0xf8, 0x90, 0x45, 0x3a, 0x1d, 0xd0, 0x11, 0x89, 0x1f, 0x00,
          0xaa, 0x00, 0x4b, 0x2e, 0x24,
        ])
      );
    } catch (_) {
      return false;
    }
  }

  function targetClass(query) {
    return CLASSES.find((name) => query.includes(name)) || null;
  }

  function hookClassObject(object, className) {
    const objectKey = Agent.ptrKey(object);
    if (!objectKey || objectClasses[objectKey]) return;
    objectClasses[objectKey] = className;

    const getMethod = Agent.comMethod(object, 4);
    const key = Agent.ptrKey(getMethod);
    if (hookedPointers[key]) return;
    hookedPointers[key] = true;

    Interceptor.attach(getMethod, {
      onEnter(args) {
        this.caller = this.returnAddress;
        this.object = args[0];
        this.property = Agent.readBstr(args[1]);
        this.value = args[3];
      },
      onLeave(retval) {
        if (retval.toInt32() !== 0) return;
        const className = objectClasses[Agent.ptrKey(this.object)];
        if (!className || !CLASSES.includes(className)) return;
        if (this.property !== "Size") return;

        Agent.writeVariantAuto(this.value, TOTAL_BYTES);

        Agent.collect(TAG, "wmi", className, this.caller.toString(), [], []);
        Agent.triggered(TAG, "wmi", className, this.caller.toString(), {
          original: { [this.property]: "patched" },
          current: { [this.property]: TOTAL_BYTES },
        });
      },
    });
  }

  function hookEnum(enumObject, className) {
    const nextMethod = Agent.comMethod(enumObject, 4);
    const key = Agent.ptrKey(nextMethod);
    if (hookedPointers[key]) return;
    hookedPointers[key] = true;

    Interceptor.attach(nextMethod, {
      onEnter(args) {
        this.objects = args[3];
        this.returned = args[4];
      },
      onLeave(retval) {
        if (retval.toInt32() < 0 || !this.objects || this.objects.isNull()) return;
        const count =
          this.returned && !this.returned.isNull() ? this.returned.readU32() : 1;
        for (let i = 0; i < count; i++) {
          hookClassObject(
            this.objects.add(i * Process.pointerSize).readPointer(),
            className,
          );
        }
      },
    });
  }

  function hookServices(services) {
    const execQuery = Agent.comMethod(services, 20);
    const key = Agent.ptrKey(execQuery);
    if (hookedPointers[key]) return;
    hookedPointers[key] = true;

    Interceptor.attach(execQuery, {
      onEnter(args) {
        this.className = targetClass(Agent.readBstr(args[2]));
        this.enumOut = args[5];
      },
      onLeave(retval) {
        if (retval.toInt32() < 0 || !this.className) return;
        hookEnum(this.enumOut.readPointer(), this.className);
      },
    });
  }

  function hookLocator(locator) {
    const connectServer = Agent.comMethod(locator, 3);
    const key = Agent.ptrKey(connectServer);
    if (hookedPointers[key]) return;
    hookedPointers[key] = true;

    Interceptor.attach(connectServer, {
      onEnter(args) {
        this.servicesOut = args[8];
      },
      onLeave(retval) {
        if (retval.toInt32() < 0 || !this.servicesOut || this.servicesOut.isNull()) return;
        hookServices(this.servicesOut.readPointer());
      },
    });
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded(MODULE_NAME, () => {
      const addr = Agent.getExport(MODULE_NAME, API_NAME);
      Interceptor.attach(addr, {
        onEnter(args) {
          this.isWmi = isWbemLocatorClsid(args[0]);
          this.objectOut = args[4];
        },
        onLeave(retval) {
          if (
            !this.isWmi ||
            retval.toInt32() < 0 ||
            !this.objectOut ||
            this.objectOut.isNull()
          ) {
            return;
          }
          hookLocator(this.objectOut.readPointer());
        },
      });
    });
    Agent.register(TAG, "wmi", "disk");
  });
})();
