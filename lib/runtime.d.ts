import * as async from "./async";
export { awaitAll } from "./async";
/**
  classes that explicitly implement this interface will become valid
  targets for code generation by pitcher.  Will be replaced with
  Builds<T>.
*/
export interface Module {
    _moduleId?: number;
    includes?: SimpleModuleConstructor[];
}
/**
  Used by pitcher.forEntry to help typescript infer the graph type
  based on the given entry module.  Convenience that maps to pitcher.build.
  See pitcher.forEntry
*/
export declare class GraphBuilder<G> {
    private entry;
    constructor(entry: Builds<G>);
    build(...modules: Builds<G>[]): G;
}
/**
  A convenience wrapper around pitcher.build that helps typescript infer
  the graph type.
  eg pitcher.forEntry(new MyModule()).build(new OtherModule()) ==
     pitcher.build<MyModuleGraph>(new MyModule(), new OtherModule());
  See pitcher.build for details.
*/
export declare function forEntry<G>(entry: Builds<G>): GraphBuilder<G>;
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
export declare function build<G>(entry: Builds<G>, ...modules: Builds<G>[]): G;
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
    get(callback?: async.DeferredCallback<T>): ProviderWork<T>;
}
/**
  Functionally has no use, but simply wraps the given promise into having
  a pitcher.Promise signature, causing pitcher to build a PromisedProvider
  for the underlying value.
  @param promise - A promise whose resolved value will be provided, rather than the promise itself.
  @returns the same promise that was given.
*/
export declare function promised<T>(promise: Promise<T>): Promise<T>;
/**
  Functionally has no use, but simply wraps the result such that pitcher
  will create a simple 'factory' around the given provider value.
  See the README for usage details.
  @param provider any normally resolvable pitcher provider or class.
  @returns the same
*/
export declare function factory<T>(provider: T): T;
/**
  A class that constructs modules and does not require arguments.
  includes can only consist of these.
*/
export interface SimpleModuleConstructor {
    new (): Module;
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
    install(graph: G, installed: InstalledModules, override: boolean): void;
}
export interface InstalledModules {
    [k: number]: boolean;
}
/**
  Used to identify Modules when determining if they have been installed
  into a graph already or not.  Searches the proto chain of an object
  for the first construction that 'inherits' after Object in the proto
  chain and assigns a unique id _moduleId to it via it's prototype.
*/
export declare function identifyModuleBase(m: Module): number;
export interface ProviderWork<T> {
    0: T;
    1: any;
    2: async.DeferredConsumer<T>;
}
/**
  Used by the code generator to infer the type of a graph's provider
  within the install function.
  @returns A function that takes a producer and creates a SingletonProvider
  instance from it.
*/
export declare function singletonProvider<T>(p: Provider<T>): (producer: async.DeferredProducer<T>) => SingletonProvider<T>;
/**
  A provide that simply returns a singleton value "as is".
*/
export declare class SingletonProvider<T> implements Provider<T> {
    private deferredConsumer;
    constructor(deferredProducer: async.DeferredProducer<T>);
    get(callback?: async.DeferredCallback<T>): [T, any, async.DeferredConsumer<T>];
}
/**
  Used by the code generator to infer the type of a graph's provider
  within the install function.
  @returns A function that takes a producer and creates a CollectionProvider
  instance from it.
*/
export declare function collectionProvider<T>(p: Provider<T[]>): (producer: Provider<T[]>[]) => CollectionProvider<T>;
/**
  A provider that collects several results together and provides a
  singleton array of the results.  Note, the given array is still
  mutable, consumers of the provider should be cautious to copy
  it out before making modifications.
*/
export declare class CollectionProvider<T> extends SingletonProvider<T[]> {
    constructor(collection: Provider<T[]>[]);
}
/**
  Used by the code generator to infer the type of a graph's provider
  within the install function.
  @returns A function that takes a factory and creates a PromisedProvider
  instance from it.
*/
export declare function promisedProvider<T>(p: Provider<T>): (producer: async.DeferredProducer<Promise<T>>) => PromisedProvider<T>;
/**
  A provider whose singleton result is determined by an async
  Promise object.  .get defers to that underlying promise's
  .then implementation.
*/
export declare class PromisedProvider<T> extends SingletonProvider<T> {
    constructor(factory: async.DeferredProducer<Promise<T>>);
}
export declare function typeOfGiven<T>(t: T): Provider<T>;
export declare function typeOfProvider<T>(t: (...args: any[]) => T): Provider<T>;
export declare function typeOfProviderPromised<T>(t: (...args: any[]) => Promise<T>): Provider<T>;
export declare function typeOfClass<T>(t: Class<T>): Provider<T>;
export declare function typeOfFactoryMethod<T>(t: (...args: any[]) => T): Provider<() => T>;
export declare function typeOfFactoryClass<T>(t: Class<T>): Provider<() => T>;
export declare function collectionTypeOfGiven<T>(t: T[]): Provider<T[]>[];
export declare function collectionTypeOfProvider<T>(t: (...args: any[]) => T[]): Provider<T[]>[];
export declare function collectionTypeOfProviderPromised<T>(t: (...args: any[]) => Promise<T[]>): Provider<T[]>[];
export interface Class<T> {
    new (...args: any[]): T;
}
export interface Collector<T> {
    (): Provider<T[]>;
}
export interface Promise<T> {
    then<TResult>(onfulfilled?: (value: T) => TResult | Promise<TResult>, onrejected?: (reason: any) => TResult | Promise<TResult>): Promise<TResult>;
}
