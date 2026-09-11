export function createCallerAbortError() {
  const error = new Error("Chatbot operation aborted by caller");
  error.code = "CHATBOT_ABORTED";
  return error;
}

export function throwIfCallerAborted(signal) {
  if (signal?.aborted) {
    throw createCallerAbortError();
  }
}

export function abortableDelay(delayMs, signal) {
  throwIfCallerAborted(signal);

  return new Promise((resolve, reject) => {
    let timerId = null;

    const cleanup = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(createCallerAbortError());
    };

    timerId = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
