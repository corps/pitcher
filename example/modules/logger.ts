import pitcher = require("pitcher");

export enum LoggingLevel {
  DEBUG, ERROR
}

const NAME_OF_LOGGING_LEVEL: { [k: number]: string } = {
  [LoggingLevel.DEBUG.valueOf()]: "DEBUG",
  [LoggingLevel.ERROR.valueOf()]: "ERROR"
};

export interface Handler {
  (line: string, level?: LoggingLevel): void
}

export class Logger {
  constructor(
    private handlers: Handler[],
    private format: string,
    private curTimeF: () => Date) {
  }

  log(line: string, level = LoggingLevel.DEBUG) {
    line = this.format.replace("{line}", line);
    line = line.replace("{level}", NAME_OF_LOGGING_LEVEL[level]);
    line = line.replace("{time}", this.curTimeF().toUTCString());
    for (let handler of this.handlers) {
      handler(line, level);
    }
  }
}

export class Module implements pitcher.Builds<ModuleGraph> {
  constructor(public providedFormat: string = "{level}:{time} {line}") { }
  providesLogger = Logger;
  contributedHandlers: Handler[] = [];
  providedCurTimeF = () => new Date();

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.formatProvider = pitcher.singletonProvider(graph.formatProvider)((resolve) =>resolve(this.providedFormat));

    graph.loggerProvider = pitcher.singletonProvider(graph.loggerProvider)((resolve, reject) => {
      var handlers = graph.handlersProvider.get();
      var format = graph.formatProvider.get();
      var curTimeF = graph.curTimeFProvider.get();

      pitcher.awaitAll([handlers[2],format[2],curTimeF[2]], (_, err) => {
        err ? reject(err) : resolve(new this.providesLogger(handlers[0], format[0], curTimeF[0]));
      });
    });

    graph.handlersCollection = graph.handlersCollection || [];
    graph.handlersCollection.push(pitcher.singletonProvider(graph.handlersProvider)((resolve) =>resolve(this.contributedHandlers)));
    if (graph.handlersProvider == null) graph.handlersProvider = pitcher.collectionProvider(graph.handlersProvider)(graph.handlersCollection);

    graph.curTimeFProvider = pitcher.singletonProvider(graph.curTimeFProvider)((resolve) =>resolve(this.providedCurTimeF));
  }
}


export class InferredModuleGraph {
  formatProvider = pitcher.typeOfGiven(Module.prototype.providedFormat);
  loggerProvider = pitcher.typeOfClass(Module.prototype.providesLogger);
  handlersProvider = pitcher.typeOfGiven(Module.prototype.contributedHandlers);
  handlersCollection = pitcher.collectionTypeOfGiven(Module.prototype.contributedHandlers);
  curTimeFProvider = pitcher.typeOfGiven(Module.prototype.providedCurTimeF);
}

export interface ModuleGraph extends InferredModuleGraph { }
