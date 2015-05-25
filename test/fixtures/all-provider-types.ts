import pitcher = require("../../lib/runtime");
import Promise = require("bluebird");

class Pizza {
  constructor(public toppings:string[]) {}
}

export class Module implements pitcher.Module {
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
  }
  contributesBestBestToppings = () => {
    return pitcher.promised(new Promise<string[]>((resolve:(p:string[])=>void, reject:(e:any)=>void) => {
      resolve(["sausage"]);
    }));
  }

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
}
