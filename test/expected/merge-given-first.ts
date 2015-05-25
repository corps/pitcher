import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Builds<ModuleGraph> {
  providedValue: string;
  providesValue() {
    return "default";
  }

  constructor(value?: string) {
    this.providedValue = value;
  }

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.valueProvider = pitcher.singletonProvider(graph.valueProvider)((resolve) => {
      if (this.providedValue !== undefined) {resolve(this.providedValue);return;}

      resolve(this.providesValue());
    });
  }
}


export class InferredModuleGraph {
  valueProvider = pitcher.typeOfGiven(Module.prototype.providedValue);
}

export interface ModuleGraph extends InferredModuleGraph {}
