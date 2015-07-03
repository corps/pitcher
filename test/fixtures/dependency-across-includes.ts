import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  includes = [HousingModule, ChickensModule]

  providesFarm(
    farmer: string,
    market: string,
    housing: string,
    chickens: string) {
    return farmer + " living in " + housing + " with " + chickens + " being sold to the " + market;
  }

  providedFarmer = "Bob";
}

export class HousingModule implements pitcher.Module {
  includes = [BusinessModule]

  providesHousing(money: number) {
    return "a house costing $" + money;
  }
}

export class BusinessModule implements pitcher.Module {
  includes = [ChickensModule]

  providesMoney(eggs: string) {
    return 1500;
  }

  providesMarket() {
    return "market"
  }
}

export class ChickensModule implements pitcher.Module {
  providesChickens() {
    return "chickens";
  }

  providesEggs(chickens: string) {
    return chickens + " eggs";
  }
}
