import pitcher = require("../lib/runtime");
import { analyzer } from "tscripter";
import * as ts from "typescript";
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
    program?: ts.Program;
    /**
      A directory that should be used to find the project's tsconfig.json
      when constructing a program.  Unused when program is given.
    */
    projectDir?: string;
}
export declare class Module implements pitcher.Builds<ModuleGraph> {
    private config;
    constructor(config?: AnalyzerConfig);
    providedProjectDir: string;
    providesProjectDir(): string;
    providesProjectConfig(projectDir: string): ts.ParsedCommandLine;
    providedTsProgram: ts.Program;
    providesTsProgram(moduleSources: string[], projectConfig: ts.ParsedCommandLine): ts.Program;
    providesAnalyzerHost(moduleSources: string[], tsProgram: ts.Program): analyzer.AnalyzerHost;
    contributedModuleSources: string[];
    install(graph: ModuleGraph, installed: pitcher.InstalledModules, override: boolean): void;
}
export declare class InferredModuleGraph {
    projectDirProvider: pitcher.Provider<string>;
    projectConfigProvider: pitcher.Provider<ts.ParsedCommandLine>;
    tsProgramProvider: pitcher.Provider<ts.Program>;
    analyzerHostProvider: pitcher.Provider<analyzer.AnalyzerHost>;
    moduleSourcesProvider: pitcher.Provider<string[]>;
    moduleSourcesCollection: pitcher.Provider<string[]>[];
}
export interface ModuleGraph extends InferredModuleGraph {
}
