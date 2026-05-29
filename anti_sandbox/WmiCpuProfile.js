(() => {
  const TAG = "anti_sandbox";
  const MODULE_NAME = "ole32.dll";
  const API_NAME = "CoCreateInstance";
  const CLASS_HINT = "Win32_Processor";
  const LOGICAL_PROCESSORS = 8;

  const hookedPointers = {};
  const objectClasses = {};

  function isWbemLocatorClsid(clsid) {
    if (!clsid || clsid.isNull()) {
      return false;
    }

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

  function hookClassObject(object, className) {
    const key = Agent.ptrKey(object);

    if (!key || objectClasses[key]) {
      return;
    }

    objectClasses[key] = className;

    const getMethod = Agent.comMethod(object, 4);
    const getKey = Agent.ptrKey(getMethod);

    if (hookedPointers[getKey]) {
      return;
    }

    hookedPointers[getKey] = true;

    Interceptor.attach(getMethod, {
      onEnter(args) {
        this.caller = this.returnAddress;
        this.object = args[0];
        this.property = Agent.readBstr(args[1]);
        this.value = args[3];
      },

      onLeave(retval) {
        if (
          retval.toInt32() !== 0 ||
          objectClasses[Agent.ptrKey(this.object)] !== CLASS_HINT
        ) {
          return;
        }

        if (
          this.property !== "NumberOfCores" &&
          this.property !== "NumberOfLogicalProcessors"
        ) {
          return;
        }

        const original = this.value.add(8).readU32();
        Agent.writeVariantU32(this.value, LOGICAL_PROCESSORS);

        Agent.collect(TAG, "wmi", CLASS_HINT, this.caller.toString(), [], []);
        Agent.triggered(TAG, "wmi", CLASS_HINT, this.caller.toString(), {
          original: { [this.property]: String(original) },
          current: { [this.property]: String(LOGICAL_PROCESSORS) },
        });
      },
    });
  }

  function hookEnum(enumObject, className) {
    const nextMethod = Agent.comMethod(enumObject, 4);
    const key = Agent.ptrKey(nextMethod);

    if (hookedPointers[key]) {
      return;
    }

    hookedPointers[key] = true;

    Interceptor.attach(nextMethod, {
      onEnter(args) {
        this.objects = args[3];
        this.returned = args[4];
      },

      onLeave(retval) {
        if (retval.toInt32() < 0 || !this.objects || this.objects.isNull()) {
          return;
        }

        const count =
          this.returned && !this.returned.isNull() ? this.returned.readU32() : 1;

        for (let i = 0; i < count; i++) {
          const object = this.objects.add(i * Process.pointerSize).readPointer();
          hookClassObject(object, className);
        }
      },
    });
  }

  function hookServices(services) {
    const execQuery = Agent.comMethod(services, 20);
    const key = Agent.ptrKey(execQuery);

    if (hookedPointers[key]) {
      return;
    }

    hookedPointers[key] = true;

    Interceptor.attach(execQuery, {
      onEnter(args) {
        this.query = Agent.readBstr(args[2]);
        this.enumOut = args[5];
      },

      onLeave(retval) {
        if (retval.toInt32() < 0 || !this.query.includes(CLASS_HINT)) {
          return;
        }

        const enumObject = this.enumOut.readPointer();
        hookEnum(enumObject, CLASS_HINT);
      },
    });
  }

  function hookLocator(locator) {
    const connectServer = Agent.comMethod(locator, 3);
    const key = Agent.ptrKey(connectServer);

    if (hookedPointers[key]) {
      return;
    }

    hookedPointers[key] = true;

    Interceptor.attach(connectServer, {
      onEnter(args) {
        this.servicesOut = args[8];
      },

      onLeave(retval) {
        if (retval.toInt32() < 0 || !this.servicesOut || this.servicesOut.isNull()) {
          return;
        }

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

    Agent.register(TAG, "wmi", CLASS_HINT);
  });
})();
