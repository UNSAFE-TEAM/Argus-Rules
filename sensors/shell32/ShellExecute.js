(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "ShellExecute";
  const TAG = "sensor";

  const API_HOOKS = [
    { moduleName: "shell32.dll", apiName: "ShellExecuteA", wide: false, ex: false },
    { moduleName: "shell32.dll", apiName: "ShellExecuteW", wide: true, ex: false },
    { moduleName: "shell32.dll", apiName: "ShellExecuteExA", wide: false, ex: true },
    { moduleName: "shell32.dll", apiName: "ShellExecuteExW", wide: true, ex: true },
  ];

  function readShellExecuteInfo(info, wide) {
    if (!info || info.isNull()) return {};

    try {
      const base = info.add(8);
      return {
        verb: Agent.readString(base.add(Process.pointerSize).readPointer(), wide),
        file: Agent.readString(base.add(Process.pointerSize * 2).readPointer(), wide),
        parameters: Agent.readString(
          base.add(Process.pointerSize * 3).readPointer(),
          wide,
        ),
        directory: Agent.readString(
          base.add(Process.pointerSize * 4).readPointer(),
          wide,
        ),
      };
    } catch (_) {
      return {};
    }
  }

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            const info = hook.ex
              ? readShellExecuteInfo(args[0], hook.wide)
              : {
                  verb: Agent.readString(args[1], hook.wide),
                  file: Agent.readString(args[2], hook.wide),
                  parameters: Agent.readString(args[3], hook.wide),
                  directory: Agent.readString(args[4], hook.wide),
                };

            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              wide: hook.wide,
              caller: this.returnAddress.toString(),
              context: this.context,
              verb: info.verb || "",
              file: info.file || "",
              parameters: info.parameters || "",
              directory: info.directory || "",
            };
            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
