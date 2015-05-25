import pitcher = require("../lib/runtime");
import { analyzer } from "tscripter";
import * as ts from "typescript";
import path = require("path");

/**
  Configures tscripter and the underlying typescript services used by
  pitcher to analyzer the source code and it's types.
*/
export interface AnalyzerConfig {
  /**
    When given, program is the ts.Program that should provide the
    syntax and type information for pitcher.  Note, when this module
    is shared across multiple runs, the same program will be used.
    Either generating a new module for each run, or updating the
    Source host with incremental changes, is necessary in that case.

    When this is /not/ given, a default program is constructed by
    analyzing the given project's tsconfig.json.
  */
  program?: ts.Program
  /**
    A directory that should be used to find the project's tsconfig.json
    when constructing a program.  Unused when program is given.
  */
  projectDir?: string
}

export class Module implements pitcher.Builds<ModuleGraph> {
  constructor(private config: AnalyzerConfig = {}) { }

  providedProjectDir = this.config.projectDir;

  providesProjectDir() {
    return process.cwd();
  }

  providesProjectConfig(projectDir: string) {
    var projectDir = this.config.projectDir || process.cwd();
    var configFilePath = ts.findConfigFile(projectDir);
    if (configFilePath == null) throw new Error("Could not find project in or parent of " + projectDir);
    var configJSON = ts.readConfigFile(configFilePath);
    var config = ts.parseConfigFile(configJSON, path.join(configFilePath, ".."));

    for (var diagnostic of config.errors) {
      if (diagnostic.category = ts.DiagnosticCategory.Error) {
        var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        throw new Error(message);
      }
    }

    return config;
  }

  providedTsProgram = this.config.program;

  providesTsProgram(moduleSources: string[], projectConfig: ts.ParsedCommandLine) {
    return ts.createProgram(moduleSources.concat(projectConfig.fileNames), projectConfig.options);
  }

  providesAnalyzerHost(
    moduleSources: string[],
    tsProgram: ts.Program
    ) {
    return new analyzer.AnalyzerHost(tsProgram || moduleSources);
  }

  contributedModuleSources: string[] = [];

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;


    graph.projectDirProvider = pitcher.singletonProvider(graph.projectDirProvider)((resolve) => {
      if (this.providedProjectDir !== undefined) {resolve(this.providedProjectDir);return;}

      resolve(this.providesProjectDir());
    });

    graph.projectConfigProvider = pitcher.singletonProvider(graph.projectConfigProvider)((resolve, reject) => {
      var projectDir = graph.projectDirProvider.get();

      pitcher.awaitAll([projectDir[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesProjectConfig(projectDir[0]));
      });
    });

    graph.tsProgramProvider = pitcher.singletonProvider(graph.tsProgramProvider)((resolve, reject) => {
      if (this.providedTsProgram !== undefined) {resolve(this.providedTsProgram);return;}

      var moduleSources = graph.moduleSourcesProvider.get();
      var projectConfig = graph.projectConfigProvider.get();

      pitcher.awaitAll([moduleSources[2],projectConfig[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesTsProgram(moduleSources[0], projectConfig[0]));
      });
    });

    graph.analyzerHostProvider = pitcher.singletonProvider(graph.analyzerHostProvider)((resolve, reject) => {
      var moduleSources = graph.moduleSourcesProvider.get();
      var tsProgram = graph.tsProgramProvider.get();

      pitcher.awaitAll([moduleSources[2],tsProgram[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesAnalyzerHost(moduleSources[0], tsProgram[0]));
      });
    });

    graph.moduleSourcesCollection = graph.moduleSourcesCollection || [];
    graph.moduleSourcesCollection.push(pitcher.singletonProvider(graph.moduleSourcesProvider)((resolve) =>resolve(this.contributedModuleSources)));
    if (graph.moduleSourcesProvider == null) graph.moduleSourcesProvider = pitcher.collectionProvider(graph.moduleSourcesProvider)(graph.moduleSourcesCollection);
  }
}


export class InferredModuleGraph {
  projectDirProvider = pitcher.typeOfGiven(Module.prototype.providedProjectDir);
  projectConfigProvider = pitcher.typeOfProvider(Module.prototype.providesProjectConfig);
  tsProgramProvider = pitcher.typeOfGiven(Module.prototype.providedTsProgram);
  analyzerHostProvider = pitcher.typeOfProvider(Module.prototype.providesAnalyzerHost);
  moduleSourcesProvider = pitcher.typeOfGiven(Module.prototype.contributedModuleSources);
  moduleSourcesCollection = pitcher.collectionTypeOfGiven(Module.prototype.contributedModuleSources);
}

export interface ModuleGraph extends InferredModuleGraph {
}
