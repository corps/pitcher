import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Builds<ModuleGraph> {
  includes = [HousingModule, ChickensModule];

  providesFarm(
    farmer: string,
    market: string,
    housing: string,
    chickens: string) {
    return farmer + " living in " + housing + " with " + chickens + " being sold to the " + market;
  }

  providedFarmer = "Bob";

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new HousingModule().install(graph, installed, false);
    new ChickensModule().install(graph, installed, false);

    graph.farmProvider = pitcher.singletonProvider(graph.farmProvider)((resolve, reject) => {
      var farmer = graph.farmerProvider.get();
      var market = graph.marketProvider.get();
      var housing = graph.housingProvider.get();
      var chickens = graph.chickensProvider.get();

      pitcher.awaitAll([farmer[2],market[2],housing[2],chickens[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesFarm(farmer[0], market[0], housing[0], chickens[0]));
      });
    });

    graph.farmerProvider = pitcher.singletonProvider(graph.farmerProvider)((resolve) =>resolve(this.providedFarmer));
  }
}

export class HousingModule implements pitcher.Builds<HousingModuleGraph> {
  includes = [BusinessModule];

  providesHousing(money: number) {
    return "a house costing $" + money;
  }

  install(graph: HousingModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new BusinessModule().install(graph, installed, false);

    graph.housingProvider = pitcher.singletonProvider(graph.housingProvider)((resolve, reject) => {
      var money = graph.moneyProvider.get();

      pitcher.awaitAll([money[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesHousing(money[0]));
      });
    });
  }
}

export class BusinessModule implements pitcher.Builds<BusinessModuleGraph> {
  includes = [ChickensModule];

  providesMoney(eggs: string) {
    return 1500;
  }

  providesMarket() {
    return "market"
  }

  install(graph: BusinessModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new ChickensModule().install(graph, installed, false);

    graph.moneyProvider = pitcher.singletonProvider(graph.moneyProvider)((resolve, reject) => {
      var eggs = graph.eggsProvider.get();

      pitcher.awaitAll([eggs[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesMoney(eggs[0]));
      });
    });

    graph.marketProvider = pitcher.singletonProvider(graph.marketProvider)((resolve) => {
      resolve(this.providesMarket());
    });
  }
}

export class ChickensModule implements pitcher.Builds<ChickensModuleGraph> {
  providesChickens() {
    return "chickens";
  }

  providesEggs(chickens: string) {
    return chickens + " eggs";
  }

  install(graph: ChickensModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.chickensProvider = pitcher.singletonProvider(graph.chickensProvider)((resolve) => {
      resolve(this.providesChickens());
    });

    graph.eggsProvider = pitcher.singletonProvider(graph.eggsProvider)((resolve, reject) => {
      var chickens = graph.chickensProvider.get();

      pitcher.awaitAll([chickens[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesEggs(chickens[0]));
      });
    });
  }
}


class InferredChickensModuleGraph {
  chickensProvider = pitcher.typeOfProvider(ChickensModule.prototype.providesChickens);
  eggsProvider = pitcher.typeOfProvider(ChickensModule.prototype.providesEggs);
}

export interface ChickensModuleGraph extends InferredChickensModuleGraph {}

class InferredBusinessModuleGraph {
  moneyProvider = pitcher.typeOfProvider(BusinessModule.prototype.providesMoney);
  marketProvider = pitcher.typeOfProvider(BusinessModule.prototype.providesMarket);
}

export interface BusinessModuleGraph extends InferredBusinessModuleGraph, ChickensModuleGraph {}

class InferredHousingModuleGraph {
  housingProvider = pitcher.typeOfProvider(HousingModule.prototype.providesHousing);
}

export interface HousingModuleGraph extends InferredHousingModuleGraph, BusinessModuleGraph {}

class InferredModuleGraph {
  farmProvider = pitcher.typeOfProvider(Module.prototype.providesFarm);
  farmerProvider = pitcher.typeOfGiven(Module.prototype.providedFarmer);
}

export interface ModuleGraph extends InferredModuleGraph, HousingModuleGraph, ChickensModuleGraph {}
