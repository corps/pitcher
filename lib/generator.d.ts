import { analyzer, statements } from "tscripter";
import Promise = require("bluebird");
import ts = require("typescript");
export declare class Run {
    private moduleSources;
    private outputDir;
    private srcDir;
    private strictMode;
    analyzerHost: analyzer.AnalyzerHost;
    curResult: RunResult;
    private sources;
    constructor(moduleSources: string[], outputDir: string, srcDir: string, strictMode: boolean, analyzerHost: analyzer.AnalyzerHost);
    run: () => Promise<RunResult>;
    getSourceRunFor(fileName: string, editable?: boolean): SourceRun;
}
export declare class SourceRun {
    run: Run;
    source: statements.Source;
    writable: boolean;
    modules: {
        [className: string]: ModuleRun;
    };
    typechecker: ts.TypeChecker;
    analyzer: analyzer.SourceAnalyzer;
    constructor(run: Run, source: statements.Source, writable: boolean);
    getDeterminedModuleRuns(): ModuleRun[];
    commitChanges(node: statements.Class | statements.Interface): void;
    determineModules: () => void;
}
export declare enum ProvidedKind {
    SINGLETON = 0,
    COLLECTION = 1,
}
export declare enum ProviderKind {
    PROVIDER = 0,
    PROVIDER_PROMISED = 1,
    CLASS = 2,
    FACTORY_METHOD = 3,
    FACTORY_CLASS = 4,
}
export declare class Provider {
    moduleRun: ModuleRun;
    property: ts.Symbol;
    name: string;
    providedKind: ProvidedKind;
    providerKind: ProviderKind;
    hasGiven: boolean;
    localDependencies: string[];
    private sourceRun;
    constructor(moduleRun: ModuleRun, property: ts.Symbol);
    match(): boolean;
    ensureValidProperty(): void;
    ensureCanMeetDependencies(allProviders: {
        [k: string]: Provider[];
    }): void;
    determineDependencies(): void;
    private determineProviderKindAndSignature();
    private isPromisedCallable(signature);
    private findValidSignature(signatures, type);
    merge(other: Provider): Provider;
    canMergeWith(other: Provider): boolean;
    private compatibleMasterOf(other);
    onlyGiven: boolean;
    onlyProvides: boolean;
    propertyName(preferGiven?: boolean): string;
    private determineIfFactoryProvider();
    propertyDeclaration: ts.Declaration;
}
export declare class ModuleRun {
    sourceRun: SourceRun;
    moduleClass: statements.Class;
    allIncludes: ModuleRun[];
    localProvidersOrdering: string[];
    localProviders: {
        [k: string]: Provider;
    };
    allProviders: {
        [k: string]: Provider[];
    };
    localIncludesTypeNames: statements.QualifiedName[];
    moduleType: ts.Type;
    moduleGraphName: string;
    inferredGraphName: string;
    moduleGraphInterface: statements.Interface;
    inferredGraphClass: statements.Class;
    pitcherQualification: statements.QualifiedName;
    installMethod: statements.Function;
    transientDependenciesOf: {
        [k: string]: string[];
    };
    constructor(sourceRun: SourceRun, moduleClass: statements.Class);
    toString(): void;
    run: () => void;
    determineBuildTarget: () => boolean;
    private checkForCircularDependencies();
    private checkDependencies(providerName, path?, seen?);
    private registerProvidersGlobally();
    private checkForGlobalConflicts();
    private ensureProvidersCanMeetDependencies();
    private followIncludes();
    private applyToInstallMethod();
    private applyToModuleGraph();
    private applytoInferredGraph();
    private prepareGenerationTargets();
    private registerProviderLocally(provider);
}
export declare class InstallWriter {
    private moduleRun;
    moduleGraphInterface: statements.Interface;
    pitcherQualification: statements.QualifiedName;
    localIncludesTypeNames: statements.QualifiedName[];
    moduleGraphName: string;
    localProvidersOrdering: string[];
    localProviders: {
        [k: string]: Provider;
    };
    allProviders: {
        [k: string]: Provider[];
    };
    factoryIdents: {
        [k: string]: statements.Expression;
    };
    static installedIdent: statements.Identifier;
    static moduleIndentityIdent: statements.Identifier;
    static overrideIdent: statements.Identifier;
    static graphIdent: statements.Identifier;
    static resolveIdent: statements.Identifier;
    static rejectIdent: statements.Identifier;
    static errIdent: statements.Identifier;
    static resolverSignature: statements.CallableSignature;
    static alreadyInstalledCheck: statements.If;
    static markInstalledStatement: statements.BinaryOperation;
    constructor(moduleRun: ModuleRun);
    buildProposedArgs(): statements.Property[];
    buildProposedBody(): statements.CodeNode[];
    private addInstallModuleStatements(proposedBody);
    private addProviderStatements(proposedBody);
    private buildProviderExpression(provider);
    private writeProviderImplBody(func, provider);
    private writeResolverBody(func, provider);
    private getGraphProviderIdent(providerName, type?);
}
export declare class RunResult {
    private outputDir;
    private srcDir;
    output: {
        [outFile: string]: SourceRun;
    };
    sourceFileNames: string[];
    constructor(outputDir: string, srcDir: string);
    outPathFor(fileName: string): string;
    add(run: SourceRun): void;
    contains(src: statements.Source): boolean;
    writeChanges(): Promise<any>;
}
