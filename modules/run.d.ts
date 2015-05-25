import pitcher = require("../lib/runtime");
import Promise = require("bluebird");
import { Module as AnalyzerModule, ModuleGraph as AnalyzerModuleGraph } from "./analyzer";
import generator = require("../lib/generator");
export interface GeneratorConfig {
    /**
      when provided, module files are determined by the given glob string.
      this may be specified with moduleFiles, in which case their results are
      concatted.
    */
    moduleGlob?: string;
    /**
      when provided, module files are determined by the given paths.
      this may be specified with moduleGlob, in which case their results are
      concatted.
    */
    moduleFiles?: string[];
    /**
      specifies the output directory for the generator.  the path is taken by
      prepending this path to the relative path from moduleSrcDir to each file.
      Defaults to moduleSrcDir.
    */
    moduleOutputDir?: string;
    /**
      specifies the relative src directory for files resolved by moduleFiles and
      moduleGlob.  The relative path between each file and this directory is
      appended to the moduleOutputDir when determining where to write the
      output.
      Defaults to the working directory.
    */
    moduleSrcDir?: string;
    /**
      defaults to true. when false, generates output even when syntax errors exist
      in the original source.
    */
    strictMode?: boolean;
}
export declare class Module implements pitcher.Builds<ModuleGraph> {
    private config;
    constructor(config?: GeneratorConfig);
    includes: typeof AnalyzerModule[];
    providedSrcDir: string;
    providedOutputDir: string;
    providedStrictMode: boolean;
    providesRunFactory: typeof generator.Run;
    providesRun: (runFactory: () => generator.Run) => () => Promise<generator.RunResult>;
    contributesModuleSources(): pitcher.Promise<string[]>;
    install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean): void;
}
export declare class InferredModuleGraph {
    srcDirProvider: pitcher.Provider<string>;
    outputDirProvider: pitcher.Provider<string>;
    strictModeProvider: pitcher.Provider<boolean>;
    runFactoryProvider: pitcher.Provider<() => generator.Run>;
    runProvider: pitcher.Provider<() => Promise<generator.RunResult>>;
    moduleSourcesProvider: pitcher.Provider<string[]>;
    moduleSourcesCollection: pitcher.Provider<string[]>[];
}
export interface ModuleGraph extends InferredModuleGraph, AnalyzerModuleGraph {
}
