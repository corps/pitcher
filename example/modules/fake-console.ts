import pitcher = require("pitcher");

export class Module implements pitcher.Builds<ModuleGraph> {
  constructor(
    public errorLogs: any[][] = [],
    public logs: any[][] = []) { }

  providesConsole(): typeof console {
    return <typeof console>{
      log: (...args: any[]) => { this.logs.push(args) },
      error: (...args: any[]) => { this.errorLogs.push(args) }
    };
  }

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.consoleProvider = pitcher.singletonProvider(graph.consoleProvider)((resolve) => {
      resolve(this.providesConsole());
    });
  }
}


export class InferredModuleGraph {
  consoleProvider = pitcher.typeOfProvider(Module.prototype.providesConsole);
}

export interface ModuleGraph extends InferredModuleGraph {}
