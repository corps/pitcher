import pitcher = require("../../../lib/runtime");
import sub = require("./sub");

export class Module implements pitcher.Builds<ModuleGraph> {
  static constructedCount = 0;
  contributedConstructorCount = [Module.constructedCount += 1];

  includes = [Sibling, sub.Module, sub.SiblingB];

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    // Rewrite me.
  }
}

export class NotAModule {
}

export class Sibling implements pitcher.Builds<SiblingGraph> {
  static constructedCount = 0;
  contributedConstructorCount = [Sibling.constructedCount += 1];

  includes = [sub.SiblingA, sub.Module];

  install(graph: SiblingGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new sub.SiblingA().install(graph, installed, false);
    new sub.Module().install(graph, installed, false);

    graph.constructorCountCollection = graph.constructorCountCollection || [];
    graph.constructorCountCollection.push(pitcher.singletonProvider(graph.constructorCountProvider)((resolve) =>resolve(this.contributedConstructorCount)));
    if (graph.constructorCountProvider == null) graph.constructorCountProvider = pitcher.collectionProvider(graph.constructorCountProvider)(graph.constructorCountCollection);
  }
}


class InferredSiblingGraph {
  constructorCountProvider = pitcher.typeOfGiven(Sibling.prototype.contributedConstructorCount);
  constructorCountCollection = pitcher.collectionTypeOfGiven(Sibling.prototype.contributedConstructorCount);
}

export interface SiblingGraph extends InferredSiblingGraph, sub.SiblingAGraph, sub.ModuleGraph {}

class InferredModuleGraph {
  constructorCountProvider = pitcher.typeOfGiven(Module.prototype.contributedConstructorCount);
  constructorCountCollection = pitcher.collectionTypeOfGiven(Module.prototype.contributedConstructorCount);
}

export interface ModuleGraph extends InferredModuleGraph, SiblingGraph, sub.ModuleGraph, sub.SiblingBGraph {}
