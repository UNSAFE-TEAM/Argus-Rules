(() => {
  const TAG = "anti_debug";
  const MODULE_NAME = "kernel32.dll";
  const API_NAME = "IsDebuggerPresent";
  const ARG_SPEC = [];

  function install() {
    Agent.attachApi(TAG, MODULE_NAME, API_NAME, () => ({
      onEnter(_args) {
        this.caller = this.returnAddress;

        Agent.collect(
          TAG,
          MODULE_NAME,
          API_NAME,
          this.caller.toString(),
          _args,
          ARG_SPEC,
        );
      },

      onLeave(retval) {
        const original = retval.toInt32();

        retval.replace(0);

        Agent.triggered(TAG, MODULE_NAME, API_NAME, this.caller.toString(), {
          original: { return: String(original) },
          current: { return: "0" },
        });
      },
    }));
  }

  Agent.safeCall(TAG, () => {
    Agent.whenModuleLoaded(MODULE_NAME, install);
  });
})();
