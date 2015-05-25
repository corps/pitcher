/**
  These async constructs are generally meant for internal usage only.
  They are documented as they explain the interface for interacting with
  runtime.Providers.
*/

/**
  Type alias for common callback interface containing a value and possible error.
*/
export interface DeferredCallback<T> {
  (v: T, err?: any): void
}

/**
  A promise-like deferred method that will ring back its result via either the
  resolve or reject functions.
*/
export interface DeferredProducer<T> {
  (resolve: (v: T) => boolean, reject: (err: any) => boolean): void
}

/**
  An interface that can be invoked with deferred callbacks, matching
  back to a source DeferredProducer.
*/
export interface DeferredConsumer<T> {
  (callback: DeferredCallback<T>): void
}

export function awaitAll(deferredConsumers: DeferredConsumer<any>[], callback: DeferredCallback<any>) {
  if (deferredConsumers.length == 0) {
    callback(null, undefined);
    return;
  }

  var awaiting = deferredConsumers.length;
  var err: any;
  var safeCallback = () => {
    try {
      callback(null, err);
    } catch (e) {
      console.error(e && e["stack"] ? e["stack"] : e);
    }
  };

  for (var consumer of deferredConsumers) {
    try {
      consumer((v, e) => {
        if (awaiting <= 0) return;

        awaiting -= 1;
        if (e) {
          err = e;
          awaiting = -1;
          safeCallback();
        } else if (awaiting == 0) {
          safeCallback();
        }
      })
    } catch (e) {
      err = e;
      awaiting = -1;
      safeCallback();
      break;
    }
  }
}

/**
  An async construction that is
  1.  deferred -- the computation will occur async and call the consumer
  either immediately if the result is ready or some other run loop if it is not.
  2.  cached -- the result will be computed only once and further calls
  will result in ultimately retrieving that cached result.
  3.  lazy -- the computation will not be invoked until the first invocation.
*/
export function cachedLazyDeferred<T>(deferred: DeferredProducer<T>): DeferredConsumer<T> {
  var resolved = false;
  var result: T;
  var err: any;
  var callbacks: DeferredCallback<T>[] = [];
  var started = false;

  var resolveCallbacks = () => {
    resolved = true;
    callbacks.forEach((c) => {
      if (!c) return;
      try {
        c(result, err);
      } catch (e) {
        console.error(e && e["stack"] ? e["stack"] : e);
      }
    });
    callbacks = [];
  };

  return (callback: DeferredCallback<T>) => {
    callbacks.push(callback);

    if (!started) {
      try {
        deferred(
          (v) => {
            if (!resolved) result = v;
            resolveCallbacks();
            return !err;
          }, (e) => {
            if (!resolved) err = e;
            resolveCallbacks();
            return !err;
          })
      } catch (e) {
        if (!resolved) err = e;
        resolveCallbacks();
      } finally {
        started = true;
      }
    }

    if (resolved) {
      resolveCallbacks();
    }
  }
}
