(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const SENSOR_NAME = "SyncObject";
  const TAG = "sensor";
  const API_HOOKS = [
    ["kernelbase.dll", "CreateMutexA", false, "mutex", "create", 2],
    ["kernelbase.dll", "CreateMutexW", true, "mutex", "create", 2],
    ["kernel32.dll", "OpenMutexA", false, "mutex", "open", 2],
    ["kernelbase.dll", "OpenMutexW", true, "mutex", "open", 2],
    ["kernelbase.dll", "CreateEventA", false, "event", "create", 3],
    ["kernelbase.dll", "CreateEventW", true, "event", "create", 3],
    ["kernelbase.dll", "OpenEventA", false, "event", "open", 2],
    ["kernelbase.dll", "OpenEventW", true, "event", "open", 2],
    ["kernel32.dll", "CreateSemaphoreA", false, "semaphore", "create", 4],
    ["kernelbase.dll", "CreateSemaphoreW", true, "semaphore", "create", 4],
    ["kernel32.dll", "OpenSemaphoreA", false, "semaphore", "open", 2],
    ["kernelbase.dll", "OpenSemaphoreW", true, "semaphore", "open", 2],
  ].map((item) => ({
    moduleName: item[0],
    apiName: item[1],
    wide: item[2],
    objectType: item[3],
    action: item[4],
    nameIndex: item[5],
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
              objectType: hook.objectType,
              action: hook.action,
              name: Agent.readString(args[hook.nameIndex], hook.wide),
              handle: null,
            };
            sensor.emit(this.ctx);
          },
        }));
      });
    }
  });
})();
