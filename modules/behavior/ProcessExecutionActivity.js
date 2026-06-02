(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "behavior";

  function command(ctx) {
    return [ctx.application, ctx.commandLine, ctx.file, ctx.parameters]
      .filter(Boolean)
      .join(" ");
  }

  ArgusSensors.use("CreateProcess", {
    name: "behavior.process_execution.create_process",
    match(ctx) {
      return !!(ctx.application || ctx.commandLine);
    },
    apply(ctx) {
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        action: "process_create",
        process: {
          application: ctx.application,
          commandLine: ctx.commandLine,
          currentDirectory: ctx.currentDirectory,
          creationFlags: String(ctx.creationFlags),
        },
      });
    },
  });

  ArgusSensors.use("ShellExecute", {
    name: "behavior.process_execution.shell_execute",
    match(ctx) {
      return !!command(ctx);
    },
    apply(ctx) {
      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
        action: "shell_execute",
        process: {
          verb: ctx.verb,
          file: ctx.file,
          parameters: ctx.parameters,
          directory: ctx.directory,
        },
      });
    },
  });
})();
