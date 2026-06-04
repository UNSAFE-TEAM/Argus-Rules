(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "CreateProcess";
  const TAG = "sensor";

  const API_HOOKS = [
    ["kernelbase.dll", "CreateProcessA", false, 0, 1, 5, 7, 9],
    ["kernelbase.dll", "CreateProcessW", true, 0, 1, 5, 7, 9],
    ["kernelbase.dll", "CreateProcessAsUserA", false, 1, 2, 6, 8, 10],
    ["kernelbase.dll", "CreateProcessAsUserW", true, 1, 2, 6, 8, 10],
    ["advapi32.dll", "CreateProcessWithLogonW", true, 4, 5, 6, 8, 10],
    ["advapi32.dll", "CreateProcessWithTokenW", true, 2, 3, 4, 6, 8],
  ].map((item) => ({
    moduleName: item[0],
    apiName: item[1],
    wide: item[2],
    applicationIndex: item[3],
    commandLineIndex: item[4],
    creationFlagsIndex: item[5],
    currentDirectoryIndex: item[6],
    processInformationIndex: item[7],
  }));

  ArgusSensors.define(SENSOR_NAME, (sensor) => {
    for (const hook of API_HOOKS) {
      Agent.whenModuleLoaded(hook.moduleName, () => {
        Agent.attachApi(TAG, hook.moduleName, hook.apiName, () => ({
          onEnter(args) {
            this.ctx = {
              sensor: SENSOR_NAME,
              moduleName: hook.moduleName,
              apiName: hook.apiName,
              wide: hook.wide,
              caller: this.returnAddress.toString(),
              context: this.context,
              application: Agent.readString(args[hook.applicationIndex], hook.wide),
              commandLine: Agent.readString(args[hook.commandLineIndex], hook.wide),
              creationFlags: args[hook.creationFlagsIndex].toUInt32(),
              currentDirectory: Agent.readString(
                args[hook.currentDirectoryIndex],
                hook.wide,
              ),
              processInformation: args[hook.processInformationIndex],
            };
            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
