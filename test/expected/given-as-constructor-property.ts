import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Builds<ModuleGraph> {
  constructor(public providedTheSecretKey:number) {
    this.providedTheSecretKey = 15;
  }

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.theSecretKeyProvider = pitcher.singletonProvider(graph.theSecretKeyProvider)((resolve) =>resolve(this.providedTheSecretKey));
  }
}


export class InferredModuleGraph {
  theSecretKeyProvider = pitcher.typeOfGiven(Module.prototype.providedTheSecretKey);
}

export interface ModuleGraph extends InferredModuleGraph {}
