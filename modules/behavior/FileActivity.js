(() => {
  const Agent = globalThis.AgentV1;
  const ArgusSensors = globalThis.ArgusSensorsV1;
  const TAG = "behavior";

  const GENERIC_WRITE = 0x40000000;
  const FILE_WRITE_DATA = 0x00000002;
  const FILE_APPEND_DATA = 0x00000004;
  const CREATE_NEW = 1;
  const CREATE_ALWAYS = 2;
  const OPEN_ALWAYS = 4;
  const TRUNCATE_EXISTING = 5;

  function emit(ctx, action, data) {
    Agent.triggered(TAG, ctx.moduleName, ctx.apiName, ctx.caller, {
      action,
      file: data,
    });
  }

  function hasWriteAccess(access) {
    const value = access.toUInt32();
    return (
      (value & GENERIC_WRITE) !== 0 ||
      (value & FILE_WRITE_DATA) !== 0 ||
      (value & FILE_APPEND_DATA) !== 0
    );
  }

  ArgusSensors.use("CreateFile", {
    name: "behavior.file.create_or_open_write",
    match(ctx) {
      const disposition = ctx.creationDisposition.toUInt32();
      return (
        !!ctx.path &&
        hasWriteAccess(ctx.desiredAccess) &&
        [CREATE_NEW, CREATE_ALWAYS, OPEN_ALWAYS, TRUNCATE_EXISTING].includes(
          disposition,
        )
      );
    },
    apply(ctx) {
      emit(ctx, "file_create_or_open_write", {
        path: ctx.path,
        desiredAccess: ctx.desiredAccess.toString(),
        creationDisposition: ctx.creationDisposition.toString(),
      });
    },
  });

  ArgusSensors.use("WriteFile", {
    name: "behavior.file.write",
    match(ctx) {
      return !!ctx.path && ctx.bytesRequested > 0;
    },
    apply(ctx) {
      emit(ctx, "file_write", {
        path: ctx.path,
        handle: ctx.handle.toString(),
        bytesRequested: String(ctx.bytesRequested),
      });
    },
  });

  ArgusSensors.use("DeleteFile", {
    name: "behavior.file.delete",
    match(ctx) {
      return !!ctx.path;
    },
    apply(ctx) {
      emit(ctx, "file_delete", { path: ctx.path });
    },
  });

  ArgusSensors.use("MoveFileEx", {
    name: "behavior.file.move",
    match(ctx) {
      return (
        !!(ctx.existingPath || ctx.newPath)
      );
    },
    apply(ctx) {
      emit(ctx, "file_move", {
        existingPath: ctx.existingPath,
        newPath: ctx.newPath,
        flags: String(ctx.flags),
      });
    },
  });

  ArgusSensors.use("CopyFileEx", {
    name: "behavior.file.copy",
    match(ctx) {
      return (
        !!(ctx.existingPath || ctx.newPath)
      );
    },
    apply(ctx) {
      emit(ctx, "file_copy", {
        existingPath: ctx.existingPath,
        newPath: ctx.newPath,
        copyFlags: String(ctx.copyFlags),
      });
    },
  });

  ArgusSensors.use("SetFileAttributes", {
    name: "behavior.file.set_attributes",
    match(ctx) {
      return !!ctx.path;
    },
    apply(ctx) {
      emit(ctx, "file_set_attributes", {
        path: ctx.path,
        attributes: String(ctx.attributes),
      });
    },
  });
})();
