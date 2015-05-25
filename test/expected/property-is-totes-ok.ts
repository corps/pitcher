import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Builds<ModuleGraph> {
  get providesMagic() {
    return (specialSomething:string) => { return "ho" + specialSomething; };
  }

  providedSpecialSomething = "!";

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.magicProvider = pitcher.singletonProvider(graph.magicProvider)((resolve, reject) => {
      var specialSomething = graph.specialSomethingProvider.get();

      pitcher.awaitAll([specialSomething[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesMagic(specialSomething[0]));
      });
    });

    graph.specialSomethingProvider = pitcher.singletonProvider(graph.specialSomethingProvider)((resolve) =>resolve(this.providedSpecialSomething));
  }
}


export class InferredModuleGraph {
  magicProvider = pitcher.typeOfProvider(Module.prototype.providesMagic);
  specialSomethingProvider = pitcher.typeOfGiven(Module.prototype.providedSpecialSomething);
}

export interface ModuleGraph extends InferredModuleGraph {}
