import pitcher = require("../../../lib/runtime");

export class Module implements pitcher.Builds<ModuleGraph> {
  static constructedCount = 0;
  contributedConstructorCount = [Module.constructedCount += 1];

  includes = [SiblingA, SiblingB];

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new SiblingA().install(graph, installed, false);
    new SiblingB().install(graph, installed, false);

    graph.constructorCountCollection = graph.constructorCountCollection || [];
    graph.constructorCountCollection.push(pitcher.singletonProvider(graph.constructorCountProvider)((resolve) =>resolve(this.contributedConstructorCount)));
    if (graph.constructorCountProvider == null) graph.constructorCountProvider = pitcher.collectionProvider(graph.constructorCountProvider)(graph.constructorCountCollection);
  }
}

export class AlsoNotAModule {
}

export class SiblingA implements pitcher.Builds<SiblingAGraph> {
  static constructedCount = 0;
  contributedConstructorCount = [SiblingA.constructedCount += 1];

  install(graph: SiblingAGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.constructorCountCollection = graph.constructorCountCollection || [];
    graph.constructorCountCollection.push(pitcher.singletonProvider(graph.constructorCountProvider)((resolve) =>resolve(this.contributedConstructorCount)));
    if (graph.constructorCountProvider == null) graph.constructorCountProvider = pitcher.collectionProvider(graph.constructorCountProvider)(graph.constructorCountCollection);
  }
}

export class SiblingB implements pitcher.Builds<SiblingBGraph> {
  static constructedCount = 0;
  contributedConstructorCount = [SiblingB.constructedCount += 1];

  includes = [SiblingA];

  install(graph: SiblingBGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new SiblingA().install(graph, installed, false);

    graph.constructorCountCollection = graph.constructorCountCollection || [];
    graph.constructorCountCollection.push(pitcher.singletonProvider(graph.constructorCountProvider)((resolve) =>resolve(this.contributedConstructorCount)));
    if (graph.constructorCountProvider == null) graph.constructorCountProvider = pitcher.collectionProvider(graph.constructorCountProvider)(graph.constructorCountCollection);
  }
}


class InferredSiblingAGraph {
  constructorCountProvider = pitcher.typeOfGiven(SiblingA.prototype.contributedConstructorCount);
  constructorCountCollection = pitcher.collectionTypeOfGiven(SiblingA.prototype.contributedConstructorCount);
}

export interface SiblingAGraph extends InferredSiblingAGraph {}

class InferredSiblingBGraph {
  constructorCountProvider = pitcher.typeOfGiven(SiblingB.prototype.contributedConstructorCount);
  constructorCountCollection = pitcher.collectionTypeOfGiven(SiblingB.prototype.contributedConstructorCount);
}

export interface SiblingBGraph extends InferredSiblingBGraph, SiblingAGraph {}

class InferredModuleGraph {
  constructorCountProvider = pitcher.typeOfGiven(Module.prototype.contributedConstructorCount);
  constructorCountCollection = pitcher.collectionTypeOfGiven(Module.prototype.contributedConstructorCount);
}

export interface ModuleGraph extends InferredModuleGraph, SiblingAGraph, SiblingBGraph {}
