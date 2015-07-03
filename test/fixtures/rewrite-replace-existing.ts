import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Builds<ModuleGraph> {
  providesTheSecretKey() { return 15; }

  install(graph:ModuleGraph, installed:pitcher.InstalledModules, override:boolean) {
    // Fix me
    1 + 1;
  }
}

class InferredModuleGraph {
  blahblahblah = 0;
  theSecretKeyProvider = pitcher.typeOfProvider(Module.prototype.providesTheSecretKey);
}

export interface JunkInterface {}

export interface ModuleGraph extends JunkInterface {}
