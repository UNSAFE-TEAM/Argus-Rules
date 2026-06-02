(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "ws2_32.Connect";
  const TAG = "sensor";
  const API_HOOKS = [
    { moduleName: "ws2_32.dll", apiName: "connect", sockaddrIndex: 1 },
    { moduleName: "ws2_32.dll", apiName: "WSAConnect", sockaddrIndex: 1 },
  ];

  function readPort(sockaddr) {
    return sockaddr.add(2).readU8() * 256 + sockaddr.add(3).readU8();
  }

  function readSockaddr(sockaddr) {
    if (!sockaddr || sockaddr.isNull()) return { family: "", address: "", port: "" };

    try {
      const family = sockaddr.readU16();
      if (family === 2) {
        return {
          family: "ipv4",
          address: [
            sockaddr.add(4).readU8(),
            sockaddr.add(5).readU8(),
            sockaddr.add(6).readU8(),
            sockaddr.add(7).readU8(),
          ].join("."),
          port: String(readPort(sockaddr)),
        };
      }

      if (family === 23) {
        const parts = [];
        for (let i = 0; i < 8; i++) {
          const value = sockaddr.add(8 + i * 2).readU8() * 256 + sockaddr.add(9 + i * 2).readU8();
          parts.push(value.toString(16));
        }

        return { family: "ipv6", address: parts.join(":"), port: String(readPort(sockaddr)) };
      }

      return { family: String(family), address: "", port: "" };
    } catch (_) {
      return { family: "", address: "", port: "" };
    }
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            const peer = readSockaddr(args[hook.sockaddrIndex]);
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              caller: this.returnAddress.toString(),
              socket: args[0],
              family: peer.family,
              address: peer.address,
              port: peer.port,
            };
            if (this.ctx.address) {
              sensor.emit(this.ctx);
            }
          },
        }));
      });
    }
  });
})();
