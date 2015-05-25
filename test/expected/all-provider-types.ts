import pitcher = require("../../lib/runtime");
import Promise = require("bluebird");

class Pizza {
  constructor(public toppings:string[]) {}
}

export class Module implements pitcher.Builds<ModuleGraph> {
  counter = 0;
  providedSecretNumber = 25683;
  providesWrappedSecretNumber = (secretNumber:number) => { return { wrapped: secretNumber} };
  providesSpecialtyPizza = Pizza;
  providesRandomNumberFactory = pitcher.factory((secretNumber:number) => {
    return secretNumber + (this.counter += 1);
  });
  providesPizzaFactory = pitcher.factory(Pizza);
  providesFuturePizza(secretNumber:number) {
    return pitcher.promised(new Promise<Pizza>((resolve:(p:Pizza)=>void, reject:(e:any)=>void) => {
      resolve(new Pizza(["pepperoni", "mushroom" + secretNumber]));
    }));
  }

  providedDoubleDipping:number[] = undefined;
  providesDoubleDipping () { return [4, 5, 6]; };


  contributedToppings = ["cheese"];
  contributesSuperToppings = () => {
    return ["bell pepper", "onion"];
  };
  contributesBestBestToppings = () => {
    return pitcher.promised(new Promise<string[]>((resolve:(p:string[])=>void, reject:(e:any)=>void) => {
      resolve(["sausage"]);
    }));
  };

  contributedTwiceOver = [1, 2, 3];
  contributesTwiceOver = (secretNumber:number, wrappedSecretNumber:{ wrapped: number }) => { return [secretNumber, wrappedSecretNumber.wrapped]; };

  providesFinalSolution(secretNumber:number, wrappedSecretNumber:{ wrapped: number }, specialtyPizza:Pizza,
    randomNumberFactory:() => number, pizzaFactory:() => Pizza, futurePizza:Pizza, doubleDipping:number[],
    toppings: string[], superToppings:string[], bestBestToppings: string[], twiceOver: number[]) {
    return {
      secretNumber: secretNumber,
      wrappedSecretNumber: wrappedSecretNumber,
      specialtyPizza: specialtyPizza,
      randomNumberFactory: randomNumberFactory,
       pizzaFactory: pizzaFactory,
       futurePizza: futurePizza,
       doubleDipping: doubleDipping,
       toppings: toppings,
       superToppings: superToppings,
       bestBestToppings: bestBestToppings,
       twiceOver: twiceOver
    }
  }

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.secretNumberProvider = pitcher.singletonProvider(graph.secretNumberProvider)((resolve) =>resolve(this.providedSecretNumber));

    graph.wrappedSecretNumberProvider = pitcher.singletonProvider(graph.wrappedSecretNumberProvider)((resolve, reject) => {
      var secretNumber = graph.secretNumberProvider.get();

      pitcher.awaitAll([secretNumber[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesWrappedSecretNumber(secretNumber[0]));
      });
    });

    graph.specialtyPizzaProvider = pitcher.singletonProvider(graph.specialtyPizzaProvider)((resolve, reject) => {
      var toppings = graph.toppingsProvider.get();

      pitcher.awaitAll([toppings[2]], (_, err) => {
        err ? reject(err) : resolve(new this.providesSpecialtyPizza(toppings[0]));
      });
    });

    graph.randomNumberFactoryProvider = pitcher.singletonProvider(graph.randomNumberFactoryProvider)((resolve, reject) => {
      var secretNumber = graph.secretNumberProvider.get();

      pitcher.awaitAll([secretNumber[2]], (_, err) => {
        err ? reject(err) : resolve(() => {
          return this.providesRandomNumberFactory(secretNumber[0]);
        });
      });
    });

    graph.pizzaFactoryProvider = pitcher.singletonProvider(graph.pizzaFactoryProvider)((resolve, reject) => {
      var toppings = graph.toppingsProvider.get();

      pitcher.awaitAll([toppings[2]], (_, err) => {
        err ? reject(err) : resolve(() => {
          return new this.providesPizzaFactory(toppings[0]);
        });
      });
    });

    graph.futurePizzaProvider = pitcher.promisedProvider(graph.futurePizzaProvider)((resolve, reject) => {
      var secretNumber = graph.secretNumberProvider.get();

      pitcher.awaitAll([secretNumber[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesFuturePizza(secretNumber[0]));
      });
    });

    graph.doubleDippingProvider = pitcher.singletonProvider(graph.doubleDippingProvider)((resolve) => {
      if (this.providedDoubleDipping !== undefined) {resolve(this.providedDoubleDipping);return;}

      resolve(this.providesDoubleDipping());
    });

    graph.toppingsCollection = graph.toppingsCollection || [];
    graph.toppingsCollection.push(pitcher.singletonProvider(graph.toppingsProvider)((resolve) =>resolve(this.contributedToppings)));
    if (graph.toppingsProvider == null) graph.toppingsProvider = pitcher.collectionProvider(graph.toppingsProvider)(graph.toppingsCollection);

    graph.superToppingsCollection = graph.superToppingsCollection || [];
    graph.superToppingsCollection.push(pitcher.singletonProvider(graph.superToppingsProvider)((resolve) => {
      resolve(this.contributesSuperToppings());
    }));
    if (graph.superToppingsProvider == null) graph.superToppingsProvider = pitcher.collectionProvider(graph.superToppingsProvider)(graph.superToppingsCollection);

    graph.bestBestToppingsCollection = graph.bestBestToppingsCollection || [];
    graph.bestBestToppingsCollection.push(pitcher.promisedProvider(graph.bestBestToppingsProvider)((resolve) => {
      resolve(this.contributesBestBestToppings());
    }));
    if (graph.bestBestToppingsProvider == null) graph.bestBestToppingsProvider = pitcher.collectionProvider(graph.bestBestToppingsProvider)(graph.bestBestToppingsCollection);

    graph.twiceOverCollection = graph.twiceOverCollection || [];
    graph.twiceOverCollection.push(pitcher.singletonProvider(graph.twiceOverProvider)((resolve, reject) => {
      if (this.contributedTwiceOver !== undefined) {resolve(this.contributedTwiceOver);return;}

      var secretNumber = graph.secretNumberProvider.get();
      var wrappedSecretNumber = graph.wrappedSecretNumberProvider.get();

      pitcher.awaitAll([secretNumber[2],wrappedSecretNumber[2]], (_, err) => {
        err ? reject(err) : resolve(this.contributesTwiceOver(secretNumber[0], wrappedSecretNumber[0]));
      });
    }));
    if (graph.twiceOverProvider == null) graph.twiceOverProvider = pitcher.collectionProvider(graph.twiceOverProvider)(graph.twiceOverCollection);

    graph.finalSolutionProvider = pitcher.singletonProvider(graph.finalSolutionProvider)((resolve, reject) => {
      var secretNumber = graph.secretNumberProvider.get();
      var wrappedSecretNumber = graph.wrappedSecretNumberProvider.get();
      var specialtyPizza = graph.specialtyPizzaProvider.get();
      var randomNumberFactory = graph.randomNumberFactoryProvider.get();
      var pizzaFactory = graph.pizzaFactoryProvider.get();
      var futurePizza = graph.futurePizzaProvider.get();
      var doubleDipping = graph.doubleDippingProvider.get();
      var toppings = graph.toppingsProvider.get();
      var superToppings = graph.superToppingsProvider.get();
      var bestBestToppings = graph.bestBestToppingsProvider.get();
      var twiceOver = graph.twiceOverProvider.get();

      pitcher.awaitAll([secretNumber[2],wrappedSecretNumber[2],specialtyPizza[2],randomNumberFactory[2],pizzaFactory[2],futurePizza[2],doubleDipping[2],toppings[2],superToppings[2],bestBestToppings[2],twiceOver[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesFinalSolution(secretNumber[0], wrappedSecretNumber[0], specialtyPizza[0], randomNumberFactory[0], pizzaFactory[0], futurePizza[0], doubleDipping[0], toppings[0], superToppings[0], bestBestToppings[0], twiceOver[0]));
      });
    });
  }
}


export class InferredModuleGraph {
  secretNumberProvider = pitcher.typeOfGiven(Module.prototype.providedSecretNumber);
  wrappedSecretNumberProvider = pitcher.typeOfProvider(Module.prototype.providesWrappedSecretNumber);
  specialtyPizzaProvider = pitcher.typeOfClass(Module.prototype.providesSpecialtyPizza);
  randomNumberFactoryProvider = pitcher.typeOfFactoryMethod(Module.prototype.providesRandomNumberFactory);
  pizzaFactoryProvider = pitcher.typeOfFactoryClass(Module.prototype.providesPizzaFactory);
  futurePizzaProvider = pitcher.typeOfProviderPromised(Module.prototype.providesFuturePizza);
  doubleDippingProvider = pitcher.typeOfGiven(Module.prototype.providedDoubleDipping);
  toppingsProvider = pitcher.typeOfGiven(Module.prototype.contributedToppings);
  toppingsCollection = pitcher.collectionTypeOfGiven(Module.prototype.contributedToppings);
  superToppingsProvider = pitcher.typeOfProvider(Module.prototype.contributesSuperToppings);
  superToppingsCollection = pitcher.collectionTypeOfProvider(Module.prototype.contributesSuperToppings);
  bestBestToppingsProvider = pitcher.typeOfProviderPromised(Module.prototype.contributesBestBestToppings);
  bestBestToppingsCollection = pitcher.collectionTypeOfProviderPromised(Module.prototype.contributesBestBestToppings);
  twiceOverProvider = pitcher.typeOfGiven(Module.prototype.contributedTwiceOver);
  twiceOverCollection = pitcher.collectionTypeOfGiven(Module.prototype.contributedTwiceOver);
  finalSolutionProvider = pitcher.typeOfProvider(Module.prototype.providesFinalSolution);
}

export interface ModuleGraph extends InferredModuleGraph {}
