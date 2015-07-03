import pitcher = require("../lib/runtime");
import ts = require("typescript");
import Promise = require("bluebird");
import glob = require("glob");
import { Module as AnalyzerModule, ModuleGraph as AnalyzerModuleGraph } from "./analyzer";
import generator = require("../lib/generator");

var globFiles: (glob: string) => Promise<string[]> = Promise.promisify<string[], string>(glob);

export interface GeneratorConfig {
  /**
    when provided, module files are determined by the given glob string.
    this may be specified with moduleFiles, in which case their results are
    concatted.
  */
  moduleGlob?: string
  /**
    when provided, module files are determined by the given paths.
    this may be specified with moduleGlob, in which case their results are
    concatted.
  */
  moduleFiles?: string[]
  /**
    specifies the output directory for the generator.  the path is taken by
    prepending this path to the relative path from moduleSrcDir to each file.
    Defaults to moduleSrcDir.
  */
  moduleOutputDir?: string
  /**
    specifies the relative src directory for files resolved by moduleFiles and
    moduleGlob.  The relative path between each file and this directory is
    appended to the moduleOutputDir when determining where to write the
    output.
    Defaults to the working directory.
  */
  moduleSrcDir?: string
  /**
    when true, pitcher will fail when any of the original source files
    contain errors according to the typescript compiler.  Not needed in
    most cases, but can be useful in certain build setups where earlier
    failures are useful, or to save resources when watching file changes.
    NOTE: When using this mode, make sure your output directory is different
    from your source directory.  If you provide strict mode when writing modules
    to the same source, you may get 'stuck' when changing a provider name breaks
    the generated code.  In general, don't use this unless you know what you
    are doing.
  */
  strictMode?: boolean
}

export class Module implements pitcher.Builds<ModuleGraph> {
  constructor(private config: GeneratorConfig = {}) {
  }

  includes = [AnalyzerModule];
  providedSrcDir = this.config.moduleSrcDir || "";
  providedOutputDir = this.config.moduleOutputDir || this.providedSrcDir;
  providedStrictMode = this.config.strictMode == null ? false : this.config.strictMode;
  providesRunFactory = pitcher.factory(generator.Run);
  providesRun = (runFactory: () => generator.Run) => () => runFactory().run();

  contributesModuleSources() {
    var baseModuleFiles = this.config.moduleFiles || [];
    if (!this.config.moduleGlob) return Promise.resolve(baseModuleFiles);
    return pitcher.promised(globFiles(this.config.moduleGlob).then((files: string[]) => {
      return baseModuleFiles.concat(files);
    }));
  }

  install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean) {
    var moduleIdentity = pitcher.identifyModuleBase(this);
    if (!override && installed[moduleIdentity]) return;

    installed[moduleIdentity] = true;

    new AnalyzerModule().install(graph, installed, false);

    graph.srcDirProvider = pitcher.singletonProvider(graph.srcDirProvider)((resolve) =>resolve(this.providedSrcDir));

    graph.outputDirProvider = pitcher.singletonProvider(graph.outputDirProvider)((resolve) =>resolve(this.providedOutputDir));

    graph.strictModeProvider = pitcher.singletonProvider(graph.strictModeProvider)((resolve) =>resolve(this.providedStrictMode));

    graph.runFactoryProvider = pitcher.singletonProvider(graph.runFactoryProvider)((resolve, reject) => {
      var moduleSources = graph.moduleSourcesProvider.get();
      var outputDir = graph.outputDirProvider.get();
      var srcDir = graph.srcDirProvider.get();
      var strictMode = graph.strictModeProvider.get();
      var analyzerHost = graph.analyzerHostProvider.get();

      pitcher.awaitAll([moduleSources[2],outputDir[2],srcDir[2],strictMode[2],analyzerHost[2]], (_, err) => {
        err ? reject(err) : resolve(() => {
          return new this.providesRunFactory(moduleSources[0], outputDir[0], srcDir[0], strictMode[0], analyzerHost[0]);
        });
      });
    });

    graph.runProvider = pitcher.singletonProvider(graph.runProvider)((resolve, reject) => {
      var runFactory = graph.runFactoryProvider.get();

      pitcher.awaitAll([runFactory[2]], (_, err) => {
        err ? reject(err) : resolve(this.providesRun(runFactory[0]));
      });
    });

    graph.moduleSourcesCollection = graph.moduleSourcesCollection || [];
    graph.moduleSourcesCollection.push(pitcher.promisedProvider(graph.moduleSourcesProvider)((resolve) => {
      resolve(this.contributesModuleSources());
    }));
    if (graph.moduleSourcesProvider == null) graph.moduleSourcesProvider = pitcher.collectionProvider(graph.moduleSourcesProvider)(graph.moduleSourcesCollection);
  }
}

export class InferredModuleGraph {
  srcDirProvider = pitcher.typeOfGiven(Module.prototype.providedSrcDir);
  outputDirProvider = pitcher.typeOfGiven(Module.prototype.providedOutputDir);
  strictModeProvider = pitcher.typeOfGiven(Module.prototype.providedStrictMode);
  runFactoryProvider = pitcher.typeOfFactoryClass(Module.prototype.providesRunFactory);
  runProvider = pitcher.typeOfProvider(Module.prototype.providesRun);
  moduleSourcesProvider = pitcher.typeOfProviderPromised(Module.prototype.contributesModuleSources);
  moduleSourcesCollection = pitcher.collectionTypeOfProviderPromised(Module.prototype.contributesModuleSources);
}

export interface ModuleGraph extends InferredModuleGraph, AnalyzerModuleGraph {}
