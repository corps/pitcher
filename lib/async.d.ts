/**
  These async constructs are generally meant for internal usage only.
  They are documented as they explain the interface for interacting with
  runtime.Providers.
*/
/**
  Type alias for common callback interface containing a value and possible error.
*/
export interface DeferredCallback<T> {
    (v: T, err?: any): void;
}
/**
  A promise-like deferred method that will ring back its result via either the
  resolve or reject functions.
*/
export interface DeferredProducer<T> {
    (resolve: (v: T) => boolean, reject: (err: any) => boolean): void;
}
/**
  An interface that can be invoked with deferred callbacks, matching
  back to a source DeferredProducer.
*/
export interface DeferredConsumer<T> {
    (callback: DeferredCallback<T>): void;
}
export declare function awaitAll(deferredConsumers: DeferredConsumer<any>[], callback: DeferredCallback<any>): void;
/**
  An async construction that is
  1.  deferred -- the computation will occur async and call the consumer
  either immediately if the result is ready or some other run loop if it is not.
  2.  cached -- the result will be computed only once and further calls
  will result in ultimately retrieving that cached result.
  3.  lazy -- the computation will not be invoked until the first invocation.
*/
export declare function cachedLazyDeferred<T>(deferred: DeferredProducer<T>): DeferredConsumer<T>;
