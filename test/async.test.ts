import assert = require("assert");
import async = require("../lib/async");

describe("async.awaitAll", () => {
  var callback: (v: any, e: any) => void;
  var callbackArgs: [any, any][];
  var consumers: async.DeferredConsumer<any>[];
  var consumerCallbacks: async.DeferredCallback<any>[];
  var err: any;

  var createConsumer = (behavior: () => void = () => { }) => {
    consumers.push((cb: async.DeferredCallback<any>) => {
      consumerCallbacks.push(cb);
      behavior();
    });
  }

  beforeEach(() => {
    err = new Error("Failure!");
    callbackArgs = [];
    consumers = [];
    consumerCallbacks = [];
    callback = ((n: any, e: any) => {
      callbackArgs.push([n, e]);
    })
  })

  context("with multiple consumers", () => {
    beforeEach(() => {
      createConsumer();
      createConsumer();
      createConsumer();
    })

    it("does not invoke the callback if some remain unresolved", () => {
      async.awaitAll(consumers, callback);
      consumerCallbacks[0](null, undefined);
      consumerCallbacks[2](null, undefined);
      assert.equal(callbackArgs.length, 0);
    })

    context("when some resolve with an err", () => {
      it("immediately invokes the callback with the first err, and not again", () => {
        async.awaitAll(consumers, callback);
        consumerCallbacks[0](null, err);
        assert.deepEqual(callbackArgs, [[null, err]]);
        consumerCallbacks[2](null, err);
        assert.equal(callbackArgs.length, 1);
        consumerCallbacks[1](true, undefined);
        assert.equal(callbackArgs.length, 1);
      })
    })

    context("once all consumers resolve successfully", () => {
      it("invokes the callback without err", () => {
        async.awaitAll(consumers, callback);
        consumerCallbacks[0](null, undefined);
        consumerCallbacks[1](null, undefined);
        consumerCallbacks[2](null, undefined);
        assert.deepEqual(callbackArgs, [[null, undefined]]);
      })
    })
  })

  context("when the callback throws an exception", () => {
    it("never bubbles to the consumer", () => {
      var callbackErr: any;
      createConsumer(() => {
        try {
          consumerCallbacks[0](null, undefined);
        } catch (e) {
          console.error(e);
          callbackErr = e;
        }
      })

      var callbackFired = false;
      async.awaitAll(consumers, () => {
        callbackFired = true;
        throw err;
      })

      assert.ok(!callbackErr);
      assert.ok(callbackFired);
    })
  })

  context("when a consumer throws an exception", () => {
    beforeEach(() => {
      createConsumer(() => { throw err })
    })

    it("invokes the callback with the exception, and no other consumer consumed", () => {
      var secondCalled = false;
      createConsumer(() => { secondCalled = true; })
      async.awaitAll(consumers, callback);

      assert.ok(!secondCalled);
      assert.deepEqual(callbackArgs, [[null, err]]);
    });

    context("and the callback then throws an exception", () => {
      it("it is not cascaded outside the call", () => {
        var callbackCalled = false;
        async.awaitAll(consumers, () => {
          callbackCalled = true;
          throw new Error("oh no!")
        })

        assert.ok(callbackCalled);
      });
    })

    context("and later invokes itself as the last successful callback", () => {
      it("only invokes the callback with the exception once", (done) => {
        async.awaitAll(consumers, callback);
        process.nextTick(() => {
          consumerCallbacks[0](true, undefined);
          assert.deepEqual(callbackArgs, [[null, err]]);
          done();
        })
      });
    })

    context("and later invokes itself with a different error", () => {
      it("only invokes the callback with the exception once", (done) => {
        async.awaitAll(consumers, callback);
        process.nextTick(() => {
          consumerCallbacks[0](null, "blah");
          assert.deepEqual(callbackArgs, [[null, err]]);
          done();
        })
      });
    });
  })

  context("when the number of deferredConsumers is 0", () => {
    beforeEach(() => { consumers = []; })
    it("invokes the callback immediately", () => {
      async.awaitAll(consumers, callback);
      assert.deepEqual(callbackArgs, [[null, undefined]]);
    })
  })
});

describe("async.cachedLazyDeferred", () => {
  var producer: async.DeferredProducer<number>;
  var consumer: async.DeferredConsumer<number>;
  var producerReject: (v: any) => void;
  var producerResolve: (v: number) => void;
  var producerCallCount: number;
  var callback: (v: number, e: any) => void;
  var callbackArgs: [number, any][];
  var err: any;
  var producerBehavior: () => void;

  beforeEach(() => {
    producerCallCount = 0;
    callbackArgs = [];
    producerReject = null;
    producerResolve = null;
    err = new Error("oops");
    producerBehavior = () => { };

    producer = (resolve, reject) => {
      producerCallCount += 1;
      producerReject = reject;
      producerResolve = resolve;
      producerBehavior();
    };

    callback = ((n: number, e: any) => {
      callbackArgs.push([n, e]);
    })

    consumer = async.cachedLazyDeferred(producer);
  });

  it("does not call the producer until the consumer is invoked, and then only once", () => {
    assert.equal(producerCallCount, 0);
    consumer(callback);
    assert.equal(producerCallCount, 1);
    consumer(callback);
    consumer(callback);
    assert.equal(producerCallCount, 1);
  });

  context("when callbacks produce an error", () => {
    it("the errors do not prevent the further invocation of callbacks", () => {
      consumer(callback)
      consumer(() => {
        throw new Error("Drat!");
      });
      consumer(callback);
      producerResolve(1);
      assert.deepEqual(callbackArgs, [[1, undefined], [1, undefined]]);
    })
  })

  describe("when the producer invokes the resolve callback", () => {
    it("produces a consumer that invokes the callback once and then with the resolve val", () => {
      consumer(callback);
      consumer(callback);
      assert.deepEqual(callbackArgs, []);
      producerResolve(11);
      assert.deepEqual(callbackArgs, [[11, undefined], [11, undefined]]);

      consumer(callback);
      assert.deepEqual(callbackArgs, [[11, undefined], [11, undefined], [11, undefined]]);
    });

    context("when the resolve / reject are invoked multiple times after", () => {
      it("prefers the original resolve", () => {
        consumer(callback);
        producerResolve(24);
        assert.deepEqual(callbackArgs, [[24, undefined]]);

        producerReject("Some err");
        producerResolve(40)
        consumer(callback);
        assert.deepEqual(callbackArgs, [[24, undefined], [24, undefined]]);
      })
    })
  })

  describe("when the producer invokes the reject callback", () => {
    it("produces a consumer that invokes the callback once and then with the rejection val", () => {
      consumer(callback);
      consumer(callback);
      assert.deepEqual(callbackArgs, []);
      producerReject("Oh no!");
      assert.deepEqual(callbackArgs, [[undefined, "Oh no!"], [undefined, "Oh no!"]]);

      consumer(callback);
      assert.deepEqual(callbackArgs, [[undefined, "Oh no!"], [undefined, "Oh no!"], [undefined, "Oh no!"]]);
    });

    context("when the resolve / reject are invoked multiple times after", () => {
      it("prefers the original reject", () => {
        consumer(callback);
        producerReject("Oh no!");
        assert.deepEqual(callbackArgs, [[undefined, "Oh no!"]]);

        producerReject("Second err");
        producerResolve(40)
        consumer(callback);
        assert.deepEqual(callbackArgs, [[undefined, "Oh no!"], [undefined, "Oh no!"]]);
      })
    })
  })

  context("the producer throws an exception", () => {
    context("after having resolved a value", () => {
      beforeEach(() => {
        producerBehavior = () => {
          producerResolve(15);
          throw err;
        }
      });

      it("produces a consumer that invokes the callback with the resolved value", () => {
        consumer(callback);
        consumer(callback);
        assert.deepEqual(callbackArgs, [[15, undefined], [15, undefined]]);
      })
    });

    context("before having resolved or rejected a value", () => {
      beforeEach(() => {
        producerBehavior = () => {
          throw err;
        }
      });

      context("when a resolve and reject are then invoked later", () => {
        it("producers a consumer that invokves the callback with the original err", (done) => {
          consumer(callback);
          process.nextTick(() => {
            producerReject(new Error("differing err"));
            producerResolve(55);
            consumer(callback);
            assert.deepEqual(callbackArgs, [[undefined, err], [undefined, err]])
            done();
          })
        })
      })

      it("producers a consumer that invokes the callback with the error", () => {
        consumer(callback);
        consumer(callback);
        assert.deepEqual(callbackArgs, [[undefined, err], [undefined, err]]);
      })
    })
  })
});
