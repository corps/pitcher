import pitcher = require("pitcher");

export class Module implements pitcher.Builds<ModuleGraph> {
  constructor(public curTime: Date) { }
  providedCurTimeF = () => {
    return this.curTime;
  };

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.curTimeFProvider = pitcher.singletonProvider(graph.curTimeFProvider)((resolve) =>resolve(this.providedCurTimeF));
  }
}


export class InferredModuleGraph {
  curTimeFProvider = pitcher.typeOfGiven(Module.prototype.providedCurTimeF);
}

export interface ModuleGraph extends InferredModuleGraph {}
