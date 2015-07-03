import assert = require("assert");
import runtime = require("../lib/runtime");
import util = require("util");
import async = require("../lib/async");
import Promise = require("bluebird");

class A { }
class B { }
class C extends B { }
class D extends B { }

describe("runtime.identifyModuleBase", () => {
  context("for a bare object", () => {
    it("throws an error", () => {
      assert.throws(() => {
        runtime.identifyModuleBase({});
      })
    })
  });

  context("for two instances who share no ancestor class", () => {
    it("is differing numbers", () => {
      assert.notEqual(runtime.identifyModuleBase(new A()), runtime.identifyModuleBase(new B()));
    })
  })

  context("for two instances who share the same class", () => {
    it("is differing numbers", () => {
      assert.equal(runtime.identifyModuleBase(new A()), runtime.identifyModuleBase(new A()));
    })
  })

  context("for two instances who share the same ancestor class", () => {
    it("is differing numbers", () => {
      assert.equal(runtime.identifyModuleBase(new B()), runtime.identifyModuleBase(new C()));
      assert.equal(runtime.identifyModuleBase(new D()), runtime.identifyModuleBase(new C()));
    })
  })
})

describe("runtime.SingletonProvider", () => {
  var resolutionValue: number;
  var err: any;

  var producer: async.DeferredProducer<number>;
  var resolveProvider: () => void;
  var failProvider: () => void;

  var provider: runtime.SingletonProvider<number>;

  beforeEach(() => {
    resolutionValue = 15;
    err = new Error("oh gosh!");

    producer = ((resolve, reject) => {
      resolveProvider = () => { resolve(resolutionValue); }
      failProvider = () => { reject(err); }
    })

    provider = new runtime.SingletonProvider<number>(producer);
  })

  describe("#get", () => {
    var getResult: [number, any, async.DeferredConsumer<number>];
    var consumer: async.DeferredConsumer<number>;
    var callback: async.DeferredCallback<number>;
    var fauxCallback: async.DeferredCallback<number>;
    var callbackArgs: any[];

    var callGet: () => void;

    beforeEach(() => {
      callbackArgs = [];
      fauxCallback = (v: number, e: any) => {
        callbackArgs.push([v, e]);
      }

      callback = null;
      callGet = () => {
        getResult = provider.get(callback);
        consumer = getResult[2];
      }
    })

    it("uses a lazy cached consumer from the given provider", () => {
      var oldF = async.cachedLazyDeferred;
      var producers: async.DeferredProducer<any>[] = [];
      var fauxConsumer = () => { };
      try {
        async.cachedLazyDeferred = (val: async.DeferredProducer<any>): async.DeferredConsumer<any> => {
          producers.push(val);
          return fauxConsumer;
        }

        var givenProducer = (resolve: Function, fail: Function) => { return true; }
        var abstractProvider = new runtime.SingletonProvider(givenProducer);

        assert.equal(producers.length, 1);
        assert.equal(producers[0], givenProducer);
        assert.equal(abstractProvider.get()[2], fauxConsumer);
      } finally {
        async.cachedLazyDeferred = oldF;
      }
    })

    context("once the given producer fails", () => {
      it("fills the second element with that failure before executing further consumer's callbacks", (done) => {
        callGet();
        consumer(() => {
          assert.equal(getResult[0], undefined);
          assert.equal(getResult[1], err);
          done();
        })

        assert.equal(getResult[0], undefined);
        assert.equal(getResult[1], undefined);

        failProvider();
      })

      context("when a callback is given", () => {
        beforeEach(() => { callback = fauxCallback });

        it("executes the get and the consumer's callbacks at that time with the failure", () => {
          callGet()
          consumer(callback);

          assert.equal(callbackArgs.length, 0);
          failProvider();

          assert.deepEqual(callbackArgs, [[undefined, err], [undefined, err]]);
        })
      })
    })

    context("once the given producer resolves", () => {
      it("fills the first element with that resolution before executinf further consumer's callbacks", (done) => {
        callGet();
        consumer(() => {
          assert.equal(getResult[0], resolutionValue);
          assert.equal(getResult[1], undefined);
          done();
        })

        assert.equal(getResult[0], undefined);
        assert.equal(getResult[1], undefined);
        resolveProvider();
      })

      context("when a callback is given", () => {
        beforeEach(() => { callback = fauxCallback });

        it("executes the get and the consumer's callbacks at that time with the resolution", () => {
          callGet()
          consumer(callback);

          assert.equal(callbackArgs.length, 0);
          resolveProvider();

          assert.deepEqual(callbackArgs, [[resolutionValue, undefined], [resolutionValue, undefined]]);
        })
      })
    })
  })
})

describe("runtime.CollectionProvider", () => {
  var collectionResolves: ((v: number[]) => void)[];
  var collectionRejects: ((e: any) => void)[];
  var collection: runtime.Provider<number[]>[];
  var provider: runtime.CollectionProvider<number>;
  var err: any;

  beforeEach(() => {
    err = new Error("oh splat!");
    collection = [];
    collectionResolves = [];
    collectionRejects = [];

    for (var i = 0; i < 2; ++i) {
      collection.push(new runtime.SingletonProvider<number[]>((resolve, reject) => {
        collectionResolves.push(resolve);
        collectionRejects.push(reject);
      }));
    }

    provider = new runtime.CollectionProvider<number>(collection);
  })

  describe("#get", () => {
    var callbackArgs: any[];

    beforeEach(() => {
      callbackArgs = [];

      provider.get((v: number[], err: any) => {
        callbackArgs.push([v, err]);
      })
    })

    context("when all of the collection providers succeed", () => {
      beforeEach(() => {
        assert.equal(callbackArgs.length, 0);
        collectionRejects[1](err);
        assert.equal(callbackArgs.length, 1);
        collectionResolves[0]([1, 2, 3]);
        assert.equal(callbackArgs.length, 1);
      })

      it("invokes the callback with the failure", () => {
        assert.deepEqual(callbackArgs, [[undefined, err]]);
      })
    })

    context("when some of the collection providers fail", () => {
      beforeEach(() => {
        assert.equal(callbackArgs.length, 0);
        collectionResolves[1]([1, 2, 3]);
        assert.equal(callbackArgs.length, 0);
        collectionResolves[0]([4, 5, 6]);
        assert.equal(callbackArgs.length, 1);
      })

      it("invokes the callback with the combined collection", () => {
        assert.deepEqual(callbackArgs, [[[1, 2, 3, 4, 5, 6], undefined]]);
      })
    })
  })
});

describe("runtime.PromisedProvider", () => {
  var promisedNumber: number;
  var promiseErr: any;
  var producerErr: any;

  var promise: Promise<number>;
  var resolvePromise: () => void;
  var failPromise: () => void;

  var producer: async.DeferredProducer<Promise<number>>;
  var resolveProducer: () => void;
  var failProducer: () => void;

  var provider: runtime.PromisedProvider<number>;

  beforeEach(() => {
    promisedNumber = 15;
    promiseErr = new Error("failure");
    producerErr = new Error("failure");

    promise = new Promise<number>((resolve: (v: number) => void, reject: (err: any) => void) => {
      resolvePromise = () => { resolve(promisedNumber) };
      failPromise = () => { reject(promiseErr); }
    })

    producer = ((resolve, reject) => {
      resolveProducer = () => { resolve(promise); }
      failProducer = () => { reject(producerErr); }
    });

    provider = new runtime.PromisedProvider<number>(producer);
  })

  describe("#get", () => {
    var callbackArgs: any[];

    beforeEach(() => {
      callbackArgs = [];

      provider.get((v: number, err: any) => {
        callbackArgs.push([v, err]);
      })
    })

    context("when the given producer fails", () => {
      beforeEach(() => {
        assert.equal(callbackArgs.length, 0);
        failProducer();
      })

      it("invokes the callback with the failure", () => {
        assert.deepEqual(callbackArgs, [[undefined, producerErr]]);
      })
    })

    context("when the given producer resolves a promise", () => {
      beforeEach(() => {
        assert.equal(callbackArgs.length, 0);
        resolveProducer();
      });


      it("does not invoke the callback whilst the promise is unresolved", () => {
        assert.equal(callbackArgs.length, 0);
      })

      context("when the promise resolves with a value", () => {
        beforeEach(() => { resolvePromise() });

        it("invokes the callback with the resolution", (done) => {
          promise.then(() => {
            assert.deepEqual(callbackArgs, [[promisedNumber, undefined]]);
            done();
          })
        })
      })

      context("when the promise rejects with a value", () => {
        beforeEach(() => { failPromise() });

        it("invokes the callback with the rejection", (done) => {
          promise.catch(() => {
            assert.deepEqual(callbackArgs, [[undefined, promiseErr]]);
            done();
          })
        })
      })
    })
  })
});
