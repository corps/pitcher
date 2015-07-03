import * as async from "./async";
export { awaitAll } from "./async";

/**
  classes that explicitly implement this interface will become valid
  targets for code generation by pitcher.  Will be replaced with
  Builds<T>.
*/
export interface Module {
  _moduleId?: number
  includes?: SimpleModuleConstructor[]
}

/**
  Used by pitcher.forEntry to help typescript infer the graph type
  based on the given entry module.  Convenience that maps to pitcher.build.
  See pitcher.forEntry
*/
export class GraphBuilder<G> {
  constructor(private entry: Builds<G>) { }
  build(...modules: Builds<G>[]): G {
    return build(this.entry, ...modules);
  }
}

/**
  A convenience wrapper around pitcher.build that helps typescript infer
  the graph type.
  eg pitcher.forEntry(new MyModule()).build(new OtherModule()) ==
     pitcher.build<MyModuleGraph>(new MyModule(), new OtherModule());
  See pitcher.build for details.
*/
export function forEntry<G>(entry: Builds<G>): GraphBuilder<G> {
  return new GraphBuilder<G>(entry);
}

/**
  Generates a ModuleGraph G given an entry module that constructs the
  initial graph's providers, and an optional series of override modules
  that provide redefinitions of existing providers.
  @param entry The module that will receieve the initial
  install(graph, {}, false) call to fill out the resulting graph with default
  providers.
  @param modules each of these given modules, in order provided, will be
  invoked with install(graph, installed, true), causing them to forceably
  attach their own providers over existing ones.  Note that each of these
  modules may also invoke any includes modules on them during
  installation.  If each of those includes have already been installed, however,
  those invocations will result in a no-ops.  In general, only the explicitly
  given 'modules' will install override provides.
*/
export function build<G>(entry: Builds<G>, ...modules: Builds<G>[]): G {
  var graph: G = <any>{};
  var installed: InstalledModules = {};
  entry.install(graph, installed, false);
  modules.forEach((m: Builds<G>) => { m.install(graph, installed, true); });
  return graph;
}

/**
  The interface modules give to their inner values.  .get should retrieve
  the singleton value stored by the graph.
*/
export interface Provider<T> {
  /**
  @param callback a callback to be invoked with the value for the
  requested provider is ready.  This may occur synchronously if
  the value is immediately ready or the value can be resolved without
  any async work.
  @returns a tuple whose elements are as follows:
  1.  the value of the provider, or undefined if it is not ready.
  2.  an error while trying to resolve the provider's value, or undefined if no error has occurred.
  3.  a DeferredConsumer that can be invoked with a callback to retrieve the value
  later.
  */
  get(callback?: async.DeferredCallback<T>): ProviderWork<T>
}

/**
  Functionally has no use, but simply wraps the given promise into having
  a pitcher.Promise signature, causing pitcher to build a PromisedProvider
  for the underlying value.
  @param promise - A promise whose resolved value will be provided, rather than the promise itself.
  @returns the same promise that was given.
*/
export function promised<T>(promise: Promise<T>): Promise<T> {
  return promise;
}

/**
  Functionally has no use, but simply wraps the result such that pitcher
  will create a simple 'factory' around the given provider value.
  See the README for usage details.
  @param provider any normally resolvable pitcher provider or class.
  @returns the same
*/
export function factory<T>(provider: T): T {
  return provider;
}

/**
  A class that constructs modules and does not require arguments.
  includes can only consist of these.
*/
export interface SimpleModuleConstructor {
  new (): Module
}

/**
  Once a Module's Graph has been code generated, the interface is changed
  to this to indicate the shape of the expected installation.
*/
export interface Builds<G> extends Module {
  /**
  @param graph an object that is mutated by having its providers set mapping
  to this module's provider definitions.
  @param installed contains the set of unique modules that have already been
  installed.  Any transient includes of this module which are already included
  in installed will themselves not be installed.  Similarly, this module itself
  will not install if it is already included in 'installed'.
  @param override Will install this module's providers, and attempt to install
  it's transient includes, even if this module is already included in 'installed'.
  */
  install(graph: G, installed: InstalledModules, override: boolean): void
}

export interface InstalledModules {
  [k: number]: boolean
}

var lastModuleId = -1;
/**
  Used to identify Modules when determining if they have been installed
  into a graph already or not.  Searches the proto chain of an object
  for the first construction that 'inherits' after Object in the proto
  chain and assigns a unique id _moduleId to it via it's prototype.
*/
export function identifyModuleBase(m: Module) {
  if (m._moduleId == null) {
    var parentClass = getBaseClass(m);
    parentClass.prototype._moduleId = ++lastModuleId;
  }

  return m._moduleId;
}

function getBaseClass(m: Module): SimpleModuleConstructor {
  var proto: any = (<any>m)["__proto__"];
  if (proto["constructor"] == Object) throw new Error("Modules must be have a non Object constructor");
  while (proto["__proto__"]["constructor"] != Object) {
    proto = proto["__proto__"];
  }
  return <any>proto["constructor"];
}

export interface ProviderWork<T> {
  0: T; 1: any; 2: async.DeferredConsumer<T>
}

/**
  Used by the code generator to infer the type of a graph's provider
  within the install function.
  @returns A function that takes a producer and creates a SingletonProvider
  instance from it.
*/
export function singletonProvider<T>(p: Provider<T>): (producer: async.DeferredProducer<T>) => SingletonProvider<T> {
  return (producer: async.DeferredProducer<T>) => {
    return new SingletonProvider<T>(producer);
  }
}

/**
  A provide that simply returns a singleton value "as is".
*/
export class SingletonProvider<T> implements Provider<T> {
  private deferredConsumer: async.DeferredConsumer<T>;

  constructor(deferredProducer: async.DeferredProducer<T>) {
    this.deferredConsumer = async.cachedLazyDeferred(deferredProducer);
  }

  get(callback?: async.DeferredCallback<T>) {
    var result: [T, any, async.DeferredConsumer<T>] = [null, null, this.deferredConsumer];
    this.deferredConsumer((v: T, err: any) => {
      result[0] = v;
      result[1] = err;
      if (callback) callback(v, err)
    });
    return result;
  }
}

/**
  Used by the code generator to infer the type of a graph's provider
  within the install function.
  @returns A function that takes a producer and creates a CollectionProvider
  instance from it.
*/
export function collectionProvider<T>(p: Provider<T[]>): (producer: Provider<T[]>[]) => CollectionProvider<T> {
  return (providerCollection: Provider<T[]>[]) => {
    return new CollectionProvider<T>(providerCollection);
  }
}

/**
  A provider that collects several results together and provides a
  singleton array of the results.  Note, the given array is still
  mutable, consumers of the provider should be cautious to copy
  it out before making modifications.
*/
export class CollectionProvider<T> extends SingletonProvider<T[]> {
  constructor(collection: Provider<T[]>[]) {
    super((resolve, fail) => {
      var result: T[] = [];
      var collectionGets: ProviderWork<any>[] = [];
      var collectionConsumers: async.DeferredConsumer<any>[] = [];
      for (var p of collection) {
        var getResult = p.get((v, err) => {
          if (err) return;
          Array.prototype.push.apply(result, v)
        });
        collectionGets.push(getResult);
        collectionConsumers.push(getResult[2]);
      }
      async.awaitAll(collectionConsumers, (_, err) => {
        err ? fail(err) : resolve(result);
      })
    });
  }
}

/**
  Used by the code generator to infer the type of a graph's provider
  within the install function.
  @returns A function that takes a factory and creates a PromisedProvider
  instance from it.
*/
export function promisedProvider<T>(p: Provider<T>): (producer: async.DeferredProducer<Promise<T>>) => PromisedProvider<T> {
  return (producer: async.DeferredProducer<Promise<T>>) => {
    return new PromisedProvider<T>(producer);
  }
}

/**
  A provider whose singleton result is determined by an async
  Promise object.  .get defers to that underlying promise's
  .then implementation.
*/
export class PromisedProvider<T> extends SingletonProvider<T> {
  constructor(factory: async.DeferredProducer<Promise<T>>) {
    super((resolve, fail) => {
      factory((promise: Promise<T>) => {
        promise.then(resolve, fail);
        return true;
      }, fail);
    });
  }
}

/*
  The following utility methods are used by pitcher to 'trick' typescript's
  type inferrence into giving us provides by the correct type without having
  to create explicit type annotations.  Generally there is no reason to
  use them directly.
*/

export function typeOfGiven<T>(t: T): Provider<T> {
  return null;
}

export function typeOfProvider<T>(t: (...args: any[]) => T): Provider<T> {
  return null;
}

export function typeOfProviderPromised<T>(t: (...args: any[]) => Promise<T>): Provider<T> {
  return null;
}

export function typeOfClass<T>(t: Class<T>): Provider<T> {
  return null;
}

export function typeOfFactoryMethod<T>(t: (...args: any[]) => T): Provider<() => T> {
  return null;
}

export function typeOfFactoryClass<T>(t: Class<T>): Provider<() => T> {
  return null;
}

export function collectionTypeOfGiven<T>(t: T[]): Provider<T[]>[] {
  return null;
}

export function collectionTypeOfProvider<T>(t: (...args: any[]) => T[]): Provider<T[]>[] {
  return null;
}

export function collectionTypeOfProviderPromised<T>(t: (...args: any[]) => Promise<T[]>): Provider<T[]>[] {
  return null;
}

export interface Class<T> {
  new (...args: any[]): T
}

export interface Collector<T> {
  (): Provider<T[]>
}

export interface Promise<T> {
  then<TResult>(
    onfulfilled?: (value: T) => TResult | Promise<TResult>,
    onrejected?: (reason: any) => TResult | Promise<TResult>
    ): Promise<TResult>;
}
