export function runtimeReadiness(adapter) {
  let ready;
  return () => {
    if (!ready)
      ready = Promise.resolve()
        .then(() => adapter.initialize())
        .catch((error) => {
          ready = undefined;
          throw error;
        });
    return ready;
  };
}
