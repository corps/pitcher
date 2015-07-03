import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Builds<ModuleGraph> {
  includes = [ SubModule ];

  providesHead() {
    return "head";
  }

  providesLowerbody(legs:string) {
    return legs + "+waits";
  }

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new SubModule().install(graph, installed, false);

    graph.headProvider = pitcher.singletonProvider(graph.headProvider)((resolve) => {
      resolve(this.providesHead());
    });

    graph.lowerbodyProvider = pitcher.singletonProvider(graph.lowerbodyProvider)((resolve, reject) => {
      var legs = graph.legsProvider.get();

      pitcher.awaitAll([legs[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesLowerbody(legs[0]));
      });
    });
  }
}

export class SubModule implements pitcher.Builds<SubModuleGraph> {
  includes = [ Module ];

  providesLegs() {
    return "legs";
  }

  providesUpperbody(head:string) {
    return "chest+" + head;
  }

  providesBody(lowerbody:string, upperbody:string) {
    return lowerbody + "+" + upperbody;
  }

  install(graph: SubModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new Module().install(graph, installed, false);

    graph.legsProvider = pitcher.singletonProvider(graph.legsProvider)((resolve) => {
      resolve(this.providesLegs());
    });

    graph.upperbodyProvider = pitcher.singletonProvider(graph.upperbodyProvider)((resolve, reject) => {
      var head = graph.headProvider.get();

      pitcher.awaitAll([head[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesUpperbody(head[0]));
      });
    });

    graph.bodyProvider = pitcher.singletonProvider(graph.bodyProvider)((resolve, reject) => {
      var lowerbody = graph.lowerbodyProvider.get();
      var upperbody = graph.upperbodyProvider.get();

      pitcher.awaitAll([lowerbody[2],upperbody[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesBody(lowerbody[0], upperbody[0]));
      });
    });
  }
}


class InferredSubModuleGraph {
  legsProvider = pitcher.typeOfProvider(SubModule.prototype.providesLegs);
  upperbodyProvider = pitcher.typeOfProvider(SubModule.prototype.providesUpperbody);
  bodyProvider = pitcher.typeOfProvider(SubModule.prototype.providesBody);
}

export interface SubModuleGraph extends InferredSubModuleGraph, ModuleGraph {}

class InferredModuleGraph {
  headProvider = pitcher.typeOfProvider(Module.prototype.providesHead);
  lowerbodyProvider = pitcher.typeOfProvider(Module.prototype.providesLowerbody);
}

export interface ModuleGraph extends InferredModuleGraph, SubModuleGraph {}
