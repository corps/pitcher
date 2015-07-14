import pitcher = require("../../lib/runtime");

class NoConstructor {
  a = 1;
}

export class Module implements pitcher.Builds<ModuleGraph> {
  providesNoConstructor = NoConstructor;

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.noConstructorProvider = pitcher.singletonProvider(graph.noConstructorProvider)((resolve) => {
      resolve(new this.providesNoConstructor());
    });
  }
}


export class InferredModuleGraph {
  noConstructorProvider = pitcher.typeOfClass(Module.prototype.providesNoConstructor);
}

export interface ModuleGraph extends InferredModuleGraph {}
