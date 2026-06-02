(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "behavior";

  const KEYWORDS = ["schtasks", "at.exe", "register-scheduledtask"];

  function command(ctx) {
    return [ctx.application, ctx.commandLine, ctx.file, ctx.parameters]
      .filter(Boolean)
      .join(" ");
  }

  function isScheduledTaskCommand(ctx) {
    const text = command(ctx).toLowerCase();
    return Agent.containsAny(text, KEYWORDS);
  }

  function emit(ctx, source) {
    Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
      action: "scheduled_task_command",
      source,
      command: command(ctx),
    });
  }

  ArgusSensors.use("CreateProcess", {
    name: "behavior.scheduled_task.create_process",
    match: isScheduledTaskCommand,
    apply(ctx) {
      emit(ctx, "create_process");
    },
  });

  ArgusSensors.use("ShellExecute", {
    name: "behavior.scheduled_task.shell_execute",
    match: isScheduledTaskCommand,
    apply(ctx) {
      emit(ctx, "shell_execute");
    },
  });
})();
