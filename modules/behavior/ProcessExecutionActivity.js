(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "behavior";

  function command(ctx) {
    return [ctx.application, ctx.commandLine, ctx.file, ctx.parameters]
      .filter(Boolean)
      .join(" ");
  }

  let currentProcessExitSeen = false;

  ArgusSensors.use("CreateProcess", {
    name: "behavior.process_execution.create_process",
    match(ctx) {
      return !!(ctx.application || ctx.commandLine);
    },
    apply(ctx) {
      const caller = Agent.resolveCallerAddress(ctx.caller, ctx.context);

      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, caller, {
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
      const caller = Agent.resolveCallerAddress(ctx.caller, ctx.context);

      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, caller, {
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

  ArgusSensors.use("ExitProcess", {
    name: "behavior.process_execution.exit_process",
    match() {
      return true;
    },
    apply(ctx) {
      currentProcessExitSeen = true;

      const caller = Agent.resolveCallerAddress(ctx.caller, ctx.context);

      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, caller, {
        action: "process_exit",
        process: {
          exitCode: String(ctx.exitCode),
        },
      });
    },
  });

  ArgusSensors.use("RtlExitUserProcess", {
    name: "behavior.process_execution.exit_process",
    match() {
      return true;
    },
    apply(ctx) {
      currentProcessExitSeen = true;

      const caller = Agent.resolveCallerAddress(ctx.caller, ctx.context);

      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, caller, {
        action: "process_exit",
        process: {
          exitCode: String(ctx.exitCode),
        },
      });
    },
  });

  ArgusSensors.use("NtTerminateProcess", {
    name: "behavior.process_execution.terminate_process",
    match(ctx) {
      const targetHandle = ctx.targetHandle ? ctx.targetHandle.toString() : "";
      const isCurrentProcess =
        targetHandle === "0xffffffffffffffff" || targetHandle === "-1";

      if (isCurrentProcess && currentProcessExitSeen) {
        return false;
      }

      return true;
    },
    apply(ctx) {
      const targetHandle = ctx.targetHandle ? ctx.targetHandle.toString() : "";
      const isCurrentProcess =
        targetHandle === "0xffffffffffffffff" || targetHandle === "-1";
      const caller = Agent.resolveCallerAddress(ctx.caller, ctx.context);

      if (isCurrentProcess) {
        currentProcessExitSeen = true;
      }

      Agent.triggered(TAG, ctx.moduleName, ctx.apiName, caller, {
        action: isCurrentProcess ? "process_exit" : "process_terminate",
        process: {
          targetHandle,
          exitCode: String(ctx.exitCode),
        },
      });
    },
  });
})();
