import pitcher = require("pitcher");
import logger = require("./logger");

type ConsoleService = typeof console;
export class Module implements pitcher.Builds<ModuleGraph> {
  includes = [logger.Module];

  providedConsole = console;
  contributesHandlers(console: ConsoleService):logger.Handler[] {
    return [(line: string, level: logger.LoggingLevel) => {
      switch (level) {
        case logger.LoggingLevel.DEBUG:
          console.log(line);
          break;
        case logger.LoggingLevel.ERROR:
          console.error(line);
          break;
      }
    }];
  }

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new logger.Module().install(graph, installed, false);

    graph.consoleProvider = pitcher.singletonProvider(graph.consoleProvider)((resolve) =>resolve(this.providedConsole));

    graph.handlersCollection = graph.handlersCollection || [];
    graph.handlersCollection.push(pitcher.singletonProvider(graph.handlersProvider)((resolve, reject) => {
      var console = graph.consoleProvider.get();

      pitcher.awaitAll([console[2]], (_, err) => {
        err ? reject(err) : resolve(this.contributesHandlers(console[0]));
      });
    }));
    if (graph.handlersProvider == null) graph.handlersProvider = pitcher.collectionProvider(graph.handlersProvider)(graph.handlersCollection);
  }
}


export class InferredModuleGraph {
  consoleProvider = pitcher.typeOfGiven(Module.prototype.providedConsole);
  handlersProvider = pitcher.typeOfProvider(Module.prototype.contributesHandlers);
  handlersCollection = pitcher.collectionTypeOfProvider(Module.prototype.contributesHandlers);
}

export interface ModuleGraph extends InferredModuleGraph, logger.ModuleGraph {}
