import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Builds<ModuleGraph> {
  providesTheSecretKey() { return 15; }

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    // FIX ME
  }
}

class InferredModuleGraph {
  theSecretKeyProvider = pitcher.typeOfProvider(Module.prototype.providesTheSecretKey);
}

export interface JunkInterface {}

export interface ModuleGraph extends InferredModuleGraph {}
