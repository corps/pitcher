import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Builds<ModuleGraph> {
  providesTheSecretKey() { return 15; }

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.theSecretKeyProvider = pitcher.singletonProvider(graph.theSecretKeyProvider)((resolve) => {
      resolve(this.providesTheSecretKey());
    });
  }
}

class InferredModuleGraph {
  theSecretKeyProvider = pitcher.typeOfProvider(Module.prototype.providesTheSecretKey);
}

export interface ModuleGraph extends InferredModuleGraph {}
