(() => {
  const Agent = globalThis.AgentV1;
  const TAG = "behavior";
  const MODULE_NAME = "advapi32.dll";

  const serviceHandles = {};

  function emit(apiName, caller, action, service) {
    Agent.triggered(TAG, MODULE_NAME, apiName, caller, {
      action,
      service,
    });
  }

  function installCreateService(apiName, wide) {
    Agent.attachApi(TAG, MODULE_NAME, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress.toString();
        this.service = {
          name: Agent.readString(args[1], wide),
          displayName: Agent.readString(args[2], wide),
          desiredAccess: args[3].toString(),
          serviceType: args[4].toString(),
          startType: args[5].toString(),
          errorControl: args[6].toString(),
          binaryPath: Agent.readString(args[7], wide),
          loadOrderGroup: Agent.readString(args[8], wide),
          dependencies: Agent.readString(args[10], wide),
          account: Agent.readString(args[11], wide),
        };
        emit(apiName, this.caller, "service_create", {
          ...this.service,
        });
      },
    }));
  }

  function installStartService(apiName, wide) {
    Agent.attachApi(TAG, MODULE_NAME, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress.toString();
        this.handle = args[0];
        this.argCount = args[1].toUInt32();
        this.serviceName = serviceHandles[args[0].toString()] || "";
        this.wide = wide;
        emit(apiName, this.caller, "service_start", {
          name: this.serviceName,
          handle: this.handle.toString(),
          argCount: String(this.argCount),
        });
      },
    }));
  }

  function installControlService() {
    Agent.attachApi(TAG, MODULE_NAME, "ControlService", () => ({
      onEnter(args) {
        this.caller = this.returnAddress.toString();
        this.handle = args[0];
        this.control = args[1].toUInt32();
        this.serviceName = serviceHandles[args[0].toString()] || "";
        emit("ControlService", this.caller, "service_control", {
          name: this.serviceName,
          handle: this.handle.toString(),
          control: String(this.control),
        });
      },
    }));
  }

  function installDeleteService() {
    Agent.attachApi(TAG, MODULE_NAME, "DeleteService", () => ({
      onEnter(args) {
        this.caller = this.returnAddress.toString();
        this.handle = args[0];
        this.serviceName = serviceHandles[args[0].toString()] || "";
        emit("DeleteService", this.caller, "service_delete", {
          name: this.serviceName,
          handle: this.handle.toString(),
        });
      },
    }));
  }

  function installChangeServiceConfig(apiName, wide) {
    Agent.attachApi(TAG, MODULE_NAME, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress.toString();
        this.handle = args[0];
        this.serviceName = serviceHandles[args[0].toString()] || "";
        this.service = {
          name: this.serviceName,
          handle: args[0].toString(),
          serviceType: args[1].toString(),
          startType: args[2].toString(),
          errorControl: args[3].toString(),
          binaryPath: Agent.readString(args[4], wide),
          loadOrderGroup: Agent.readString(args[5], wide),
          dependencies: Agent.readString(args[7], wide),
          account: Agent.readString(args[8], wide),
          displayName: Agent.readString(args[10], wide),
        };
        emit(apiName, this.caller, "service_change_config", this.service);
      },
    }));
  }

  function installChangeServiceConfig2(apiName, wide) {
    Agent.attachApi(TAG, MODULE_NAME, apiName, () => ({
      onEnter(args) {
        this.caller = this.returnAddress.toString();
        this.handle = args[0];
        this.serviceName = serviceHandles[args[0].toString()] || "";
        this.infoLevel = args[1].toUInt32();
        this.info = args[2];
        this.wide = wide;
        emit(apiName, this.caller, "service_change_config2", {
          name: this.serviceName,
          handle: this.handle.toString(),
          infoLevel: String(this.infoLevel),
          info: this.info.toString(),
        });
      },
    }));
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded(MODULE_NAME, () => {
      installCreateService("CreateServiceA", false);
      installCreateService("CreateServiceW", true);
      installStartService("StartServiceA", false);
      installStartService("StartServiceW", true);
      installControlService();
      installDeleteService();
      installChangeServiceConfig("ChangeServiceConfigA", false);
      installChangeServiceConfig("ChangeServiceConfigW", true);
      installChangeServiceConfig2("ChangeServiceConfig2A", false);
      installChangeServiceConfig2("ChangeServiceConfig2W", true);
    });
  });
})();
