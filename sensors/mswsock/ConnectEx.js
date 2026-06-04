(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "mswsock.ConnectEx";
  const TAG = "sensor";
  const SIO_GET_EXTENSION_FUNCTION_POINTER = 0xc8000006;
  const WSAID_CONNECTEX = [
    0xb9, 0x07, 0xa2, 0x25, 0xf3, 0xdd, 0x60, 0x46,
    0x8e, 0xe9, 0x76, 0xe5, 0x8c, 0x74, 0x06, 0x3e,
  ];

  globalThis.ArgusSensorState = globalThis.ArgusSensorState || {};
  ArgusSensorState.connectEx = ArgusSensorState.connectEx || {};

  function readPort(sockaddr) {
    return sockaddr.add(2).readU8() * 256 + sockaddr.add(3).readU8();
  }

  function readSockaddr(sockaddr) {
    if (!sockaddr || sockaddr.isNull()) {
      return { family: "", address: "", port: "" };
    }

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
          const value =
            sockaddr.add(8 + i * 2).readU8() * 256 +
            sockaddr.add(9 + i * 2).readU8();
          parts.push(value.toString(16));
        }

        return {
          family: "ipv6",
          address: parts.join(":"),
          port: String(readPort(sockaddr)),
        };
      }

      return { family: String(family), address: "", port: "" };
    } catch (_) {
      return { family: "", address: "", port: "" };
    }
  }

  function attachConnectEx(sensor, address) {
    if (!address || address.isNull()) {
      return;
    }

    const key = address.toString();
    if (ArgusSensorState.connectEx[key]) {
      return;
    }

    ArgusSensorState.connectEx[key] = true;

    Interceptor.attach(address, {
      onEnter(args) {
        const peer = readSockaddr(args[1]);
        this.ctx = {
          sensor: SENSOR_NAME,
          moduleName: "mswsock.dll",
          apiName: "ConnectEx",
          caller: this.returnAddress.toString(),
          socket: args[0],
          family: peer.family,
          address: peer.address,
          port: peer.port,
        };

        if (this.ctx.address) {
          Agent.withInvocation(this.returnAddress, this.context, () =>
            sensor.emit(this.ctx),
          );
        }
      },
    });
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    Agent.whenModuleLoaded("ws2_32.dll", () => {
      Agent.attachApi(TAG, "ws2_32.dll", "WSAIoctl", () => ({
        onEnter(args) {
          this.isConnectExQuery =
            args[1].toUInt32() === SIO_GET_EXTENSION_FUNCTION_POINTER &&
            Agent.isGuid(args[2], WSAID_CONNECTEX);
          this.outBuffer = args[4];
        },

        onLeave(retval) {
          if (!this.isConnectExQuery || retval.toInt32() !== 0) {
            return;
          }

          try {
            attachConnectEx(sensor, this.outBuffer.readPointer());
          } catch (_) {
          }
        },
      }));
    });
  });
})();
