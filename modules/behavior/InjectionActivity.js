(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "behavior";

  function emit(ctx, action, injection) {
    Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
      action,
      injection,
    });
  }

  function ptrString(value) {
    return value ? value.toString() : "";
  }

  function uintString(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  ArgusSensors.use("ProcessAccess", {
    name: "behavior.injection.process_open",
    match(ctx) {
      return ctx.processId !== 0;
    },
    apply(ctx) {
      emit(ctx, "process_open", {
        processId: String(ctx.processId),
        desiredAccess: "0x" + ctx.desiredAccess.toString(16),
        inheritHandle: String(ctx.inheritHandle),
        handle: ptrString(ctx.handle),
      });
    },
  });

  ArgusSensors.use("RemoteMemory", {
    name: "behavior.injection.remote_memory",
    match() {
      return true;
    },
    apply(ctx) {
      if (ctx.apiName === "VirtualAllocEx") {
        emit(ctx, "remote_memory_alloc", {
          processHandle: ptrString(ctx.processHandle),
          requestedAddress: ptrString(ctx.requestedAddress),
          address: ptrString(ctx.address),
          size: ptrString(ctx.size),
          allocationType: "0x" + ctx.allocationType.toString(16),
          protect: "0x" + ctx.protect.toString(16),
        });
        return;
      }

      if (ctx.apiName === "WriteProcessMemory") {
        emit(ctx, "remote_memory_write", {
          processHandle: ptrString(ctx.processHandle),
          address: ptrString(ctx.address),
          buffer: ptrString(ctx.buffer),
          size: ptrString(ctx.size),
          bytesWritten: ctx.bytesWritten || "",
        });
        return;
      }

      if (ctx.apiName === "VirtualProtectEx") {
        emit(ctx, "remote_memory_protect", {
          processHandle: ptrString(ctx.processHandle),
          address: ptrString(ctx.address),
          size: ptrString(ctx.size),
          oldProtect: ctx.oldProtect || "",
          newProtect: "0x" + ctx.newProtect.toString(16),
        });
      }
    },
  });

  ArgusSensors.use("ThreadInjection", {
    name: "behavior.injection.thread",
    match() {
      return true;
    },
    apply(ctx) {
      if (
        ctx.apiName === "CreateRemoteThread" ||
        ctx.apiName === "CreateRemoteThreadEx"
      ) {
        emit(ctx, "remote_thread_create", {
          processHandle: ptrString(ctx.processHandle),
          startAddress: ptrString(ctx.startAddress),
          parameter: ptrString(ctx.parameter),
          creationFlags: "0x" + ctx.creationFlags.toString(16),
          threadHandle: ptrString(ctx.threadHandle),
          threadId: ctx.threadId || "",
        });
        return;
      }

      if (ctx.apiName === "QueueUserAPC") {
        emit(ctx, "apc_queue", {
          threadHandle: ptrString(ctx.threadHandle),
          apcRoutine: ptrString(ctx.apcRoutine),
          data: ptrString(ctx.data),
        });
        return;
      }

      if (ctx.apiName === "SetThreadContext") {
        emit(ctx, "thread_context_set", {
          threadHandle: ptrString(ctx.threadHandle),
          context: ptrString(ctx.context),
        });
        return;
      }

      if (ctx.apiName === "ResumeThread") {
        emit(ctx, "thread_resume", {
          threadHandle: ptrString(ctx.threadHandle),
        });
      }
    },
  });

  ArgusSensors.use("NtCreateThreadEx", {
    name: "behavior.injection.nt_create_thread_ex",
    match() {
      return true;
    },
    apply(ctx) {
      emit(ctx, "remote_thread_create", {
        processHandle: ptrString(ctx.processHandle),
        startAddress: ptrString(ctx.startAddress),
        parameter: ptrString(ctx.parameter),
        desiredAccess: "0x" + ctx.desiredAccess.toString(16),
        createFlags: "0x" + ctx.createFlags.toString(16),
        threadHandle: ptrString(ctx.threadHandle),
      });
    },
  });
})();
