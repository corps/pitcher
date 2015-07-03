import pitcher = require("pitcher");
import consoleLogger = require("./console-logger");
import Promise = require("bluebird");
import fs = require("fs");
import {LoggingLevel, Logger} from "./logger";

var readdir = Promise.promisify(fs.readdir);
var stat = Promise.promisify(fs.stat);

export class App {
  constructor(
    public oldestFile:string,
    public oldestFilePromise:Promise<string>,
    public rerun:()=>Promise<string>) {
  }
}

export class Module implements pitcher.Builds<ModuleGraph> {
  includes = [consoleLogger.Module];
  constructor(public providedTargetDir: string) { }

  findOldestFile(logger: Logger, targetDir: string) {
    return readdir(targetDir).then((files) => {
      logger.log("found directory files " + files.join(","));
      return Promise.all(files.map(f => stat(targetDir + "/" + f))).then((stats) => {
        var times = stats.map(s => s.mtime.getTime());
        var oldest = Math.min(...times);
        return targetDir + "/" + files[times.indexOf(oldest)];
      })
    }).then<string>(null, (e): any => {
      logger.log(e.toString(), LoggingLevel.ERROR);
      throw e;
    })
  }

  providesApp = App;
  providesOldestFilePromise = this.findOldestFile;
  providesOldestFile = (oldestFilePromise: Promise<string>) => {
    return pitcher.promised(oldestFilePromise);
  };
  providesRerun = pitcher.factory(this.findOldestFile);

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new consoleLogger.Module().install(graph, installed, false);

    graph.targetDirProvider = pitcher.singletonProvider(graph.targetDirProvider)((resolve) =>resolve(this.providedTargetDir));

    graph.appProvider = pitcher.singletonProvider(graph.appProvider)((resolve, reject) => {
      var oldestFile = graph.oldestFileProvider.get();
      var oldestFilePromise = graph.oldestFilePromiseProvider.get();
      var rerun = graph.rerunProvider.get();

      pitcher.awaitAll([oldestFile[2],oldestFilePromise[2],rerun[2]], (_, err) => {
        err ? reject(err) : resolve(new this.providesApp(oldestFile[0], oldestFilePromise[0], rerun[0]));
      });
    });

    graph.oldestFilePromiseProvider = pitcher.singletonProvider(graph.oldestFilePromiseProvider)((resolve, reject) => {
      var logger = graph.loggerProvider.get();
      var targetDir = graph.targetDirProvider.get();

      pitcher.awaitAll([logger[2],targetDir[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesOldestFilePromise(logger[0], targetDir[0]));
      });
    });

    graph.oldestFileProvider = pitcher.promisedProvider(graph.oldestFileProvider)((resolve, reject) => {
      var oldestFilePromise = graph.oldestFilePromiseProvider.get();

      pitcher.awaitAll([oldestFilePromise[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesOldestFile(oldestFilePromise[0]));
      });
    });

    graph.rerunProvider = pitcher.singletonProvider(graph.rerunProvider)((resolve, reject) => {
      var logger = graph.loggerProvider.get();
      var targetDir = graph.targetDirProvider.get();

      pitcher.awaitAll([logger[2],targetDir[2]], (_, err) => {
        err ? reject(err) : resolve(() => {
          return this.providesRerun(logger[0], targetDir[0]);
        });
      });
    });
  }
}


export class InferredModuleGraph {
  targetDirProvider = pitcher.typeOfGiven(Module.prototype.providedTargetDir);
  appProvider = pitcher.typeOfClass(Module.prototype.providesApp);
  oldestFilePromiseProvider = pitcher.typeOfProvider(Module.prototype.providesOldestFilePromise);
  oldestFileProvider = pitcher.typeOfProviderPromised(Module.prototype.providesOldestFile);
  rerunProvider = pitcher.typeOfFactoryMethod(Module.prototype.providesRerun);
}

export interface ModuleGraph extends InferredModuleGraph, consoleLogger.ModuleGraph { }
