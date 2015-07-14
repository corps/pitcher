import { analyzer, statements } from "tscripter";
import Promise = require("bluebird");
import path = require("path");
import ts = require("typescript");
import utils = require("./generator-utils");

export class Run {
  curResult = new RunResult(this.outputDir, this.srcDir);
  private sources: { [fn: string]: SourceRun } = {};

  constructor(
    private moduleSources: string[],
    private outputDir: string,
    private srcDir: string,
    private strictMode: boolean,
    public analyzerHost: analyzer.AnalyzerHost
    ) { }

  run = utils.cachedNonReentrant<Promise<RunResult>>((): Promise<RunResult> => {
    return new Promise<RunResult>((resolve: (r: RunResult) => void, reject: (e: any) => void) => {
      var modulesToBuild: ModuleRun[] = [];

      if (this.strictMode) {
        var diagnostics = ts.getPreEmitDiagnostics(this.analyzerHost.program);
        for (var diagnostic of diagnostics) {
          if (diagnostic.category == ts.DiagnosticCategory.Error) {
            var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            throw new Error(message);
          }
        }
      }

      for (var filePath of this.moduleSources) {
        var sourceRun = this.getSourceRunFor(filePath, true);
        sourceRun.determineModules();
        modulesToBuild = modulesToBuild.concat(sourceRun.getDeterminedModuleRuns());
      }

      for (var moduleRun of modulesToBuild) {
        moduleRun.run();
      }

      resolve(this.curResult);
    })
  });

  getSourceRunFor(fileName: string, editable = false) {
    var sourceRun = this.sources[fileName];
    if (sourceRun == null) {
      sourceRun = this.sources[fileName] = new SourceRun(this, this.analyzerHost.getSource(fileName), editable);
    }
    return sourceRun;
  }
}

export class SourceRun {
  modules: { [className: string]: ModuleRun } = {};
  typechecker = this.run.analyzerHost.typechecker;
  analyzer = this.run.analyzerHost.getAnalyzer(this.source);

  constructor(
    public run: Run,
    public source: statements.Source,
    public writable: boolean
    ) { }

  getDeterminedModuleRuns() {
    var result: ModuleRun[] = [];
    for (var k in this.modules) result.push(this.modules[k]);
    return result;
  }

  commitChanges(node: statements.Class|statements.Interface) {
    node.markDirty();
    this.source.markDirty();
    this.run.curResult.add(this);
  }

  determineModules = utils.once(() => {
    this.analyzer.analyze();
    var sourceSymbol = <ts.Symbol>(<any>this.source.node)["symbol"];

    for (var moduleClass of this.source.elements) {
      if (moduleClass instanceof statements.Class) {
        if (moduleClass.modifiers.indexOf("declare") != -1) continue;

        var moduleRun = new ModuleRun(this, moduleClass);
        if (!moduleRun.determineBuildTarget()) continue;

        if (!(moduleClass.name in sourceSymbol.exports)) {
          throw new Error(utils.formatErr(moduleClass.node,
            "any pitcher.Module must be a declared export"));
        }

        this.modules[moduleClass.name] = moduleRun;
      }
    }
  });
}

export enum ProvidedKind {
  SINGLETON, COLLECTION
}

const PROVIDED_TYPE_OF: { [k: string]: ProvidedKind } = {
  "contribute": ProvidedKind.COLLECTION,
  "provide": ProvidedKind.SINGLETON
}

const PREFIX_OF_PROVIDED_TYPE: { [k: number]: string } = {}
for (var prefix in PROVIDED_TYPE_OF) {
  PREFIX_OF_PROVIDED_TYPE[PROVIDED_TYPE_OF[prefix].valueOf()] = prefix;
}

export enum ProviderKind {
  // These are available to singletons and collections
  PROVIDER, PROVIDER_PROMISED,

  // These are available only to singletons
  CLASS, FACTORY_METHOD, FACTORY_CLASS
}

const PROVIDER_TYPE_NAME: { [k: number]: string } = {
  [ProviderKind.PROVIDER.valueOf()]: "Provider",
  [ProviderKind.PROVIDER_PROMISED.valueOf()]: "ProviderPromised",
  [ProviderKind.CLASS.valueOf()]: "Class",
  [ProviderKind.FACTORY_METHOD.valueOf()]: "FactoryMethod",
  [ProviderKind.FACTORY_CLASS.valueOf()]: "FactoryClass"
}

const PROVIDED_CANDIDATES = /(contribute[sd]|provide[sd])(.+)/;

export class Provider {
  name: string;
  providedKind: ProvidedKind;
  providerKind: ProviderKind;
  hasGiven: boolean = false;
  localDependencies: string[] = [];

  private sourceRun: SourceRun = this.moduleRun.sourceRun;

  constructor(public moduleRun: ModuleRun, public property: ts.Symbol) { }

  match(): boolean {
    var match = this.property.name.match(PROVIDED_CANDIDATES);
    if (match == null) return false;

    var [_, type, name] = match;

    this.name = name[0].toLowerCase() + name.slice(1);
    this.providedKind = PROVIDED_TYPE_OF[type.substring(0, type.length - 1)];
    this.hasGiven = type[type.length - 1] == "d";

    return true;
  }

  ensureValidProperty() {
    if (this.property.declarations == null || this.property.valueDeclaration == null) {
      throw new Error(utils.formatErr(this.property.declarations[1],
        `${this.property.name} is named like a provider, but providers may only be plain attributes.`))
    }

    var flags = this.property.valueDeclaration.flags;
    if (!(flags & ts.NodeFlags.Public || flags === 0)) {
      throw new Error(utils.formatErr(this.property.declarations[0],
        `${this.property.name} is named like a provider, but providers may only be public`))
    }
  }

  ensureCanMeetDependencies(allProviders: { [k: string]: Provider[] }) {
    for (var dependency of this.localDependencies) {
      if (!(dependency in allProviders)) {
        throw new Error(utils.formatErr(this.property.declarations[0],
          `${this.property.name} requires dependency named ${dependency}, but no provider was found`));
      }
    }
  }

  determineDependencies() {
    if (this.hasGiven) return;
    var [providerKind, signature] = this.determineProviderKindAndSignature();

    this.providerKind = providerKind;

    for (var parameter of signature.parameters) {
      this.localDependencies.push(parameter.name);
    }
  }

  private determineProviderKindAndSignature(): [ProviderKind, ts.Signature] {
    var propertyType = this.sourceRun.typechecker.getTypeOfSymbolAtLocation(this.property, this.propertyDeclaration);

    var callable = this.findValidSignature(propertyType.getCallSignatures(), "callable");

    if (this.providedKind == ProvidedKind.SINGLETON) {
      var isFactory = this.determineIfFactoryProvider();
      var constructor = this.findValidSignature(propertyType.getConstructSignatures(), "class");

      if (constructor != null) {
        return [isFactory ? ProviderKind.FACTORY_CLASS : ProviderKind.CLASS, constructor];
      }

      if (callable != null && isFactory) {
        return [ProviderKind.FACTORY_METHOD, callable]
      }
    }

    if (callable != null) {
      return [
        this.isPromisedCallable(callable) ? ProviderKind.PROVIDER_PROMISED : ProviderKind.PROVIDER,
        callable
      ];
    }

    throw new Error(utils.formatErr(this.propertyDeclaration,
      `Provider ${this.name} is not of valid construction.`));
  }

  private isPromisedCallable(signature: ts.Signature) {
    var returnType = this.sourceRun.typechecker.getReturnTypeOfSignature(signature);

    return utils.isRuntimeSymbol(returnType.symbol, "Promise", this.sourceRun.run.analyzerHost.program);
  }

  private findValidSignature(signatures: ts.Signature[], type: string) {
    if (signatures.length > 1) {
      throw new Error(utils.formatErr(this.propertyDeclaration,
        `Provider ${this.name} cannot be inferred from given ${type}, as it has multiple signature options.  Create an explicit provider.`));
    }

    if (signatures.length == 0) return null;
    var signature = signatures[0];
    return signature;
  }

  merge(other: Provider): Provider {
    var master = this.compatibleMasterOf(other);
    master.hasGiven = true;
    return master;
  }

  canMergeWith(other: Provider) {
    return this.compatibleMasterOf(other) != null;
  }

  private compatibleMasterOf(other: Provider): Provider {
    if (this.providedKind != other.providedKind) {
      return null
    };

    if (this.onlyGiven && other.onlyProvides) {
      return other;
    }

    if (this.onlyProvides && other.onlyGiven) {
      return this;
    }

    return null;
  }

  get classConstruction() {
    return this.providerKind == ProviderKind.CLASS || this.providerKind == ProviderKind.FACTORY_CLASS;
  }

  get onlyGiven() {
    return this.hasGiven && this.providerKind == null;
  }

  get onlyProvides() {
    return !this.hasGiven && this.providerKind != null;
  }

  propertyName(preferGiven = true) {
    var propertyPrefix = PREFIX_OF_PROVIDED_TYPE[this.providedKind];
    if (this.hasGiven && (preferGiven || this.providerKind == null)) propertyPrefix += "d";
    else propertyPrefix += "s";

    return propertyPrefix + this.name[0].toUpperCase() + this.name.slice(1);
  }

  private determineIfFactoryProvider(): boolean {
    if (this.propertyDeclaration.kind == ts.SyntaxKind.PropertyDeclaration) {
      var declaration = <ts.PropertyDeclaration>this.propertyDeclaration;
      if (declaration.initializer != null && declaration.initializer.kind == ts.SyntaxKind.CallExpression) {
        var call = <ts.CallExpression>declaration.initializer;

        var type = this.sourceRun.typechecker.getTypeAtLocation(call.expression);

        return utils.isRuntimeSymbol(type.symbol, "factory", this.sourceRun.run.analyzerHost.program);
      }
    }
    return false;
  }

  get propertyDeclaration() {
    return this.property.declarations[0];
  }
}

export class ModuleRun {
  allIncludes: ModuleRun[] = [];
  localProvidersOrdering: string[] = [];
  localProviders: { [k: string]: Provider } = {};
  allProviders: { [k: string]: Provider[] } = {};
  localIncludesTypeNames: statements.QualifiedName[] = [];
  moduleType = this.sourceRun.typechecker.getTypeAtLocation(this.moduleClass.node);
  moduleGraphName = this.moduleClass.name + "Graph";
  inferredGraphName = "Inferred" + this.moduleGraphName;
  moduleGraphInterface: statements.Interface;
  inferredGraphClass: statements.Class;
  pitcherQualification: statements.QualifiedName;
  installMethod: statements.Function;
  transientDependenciesOf: { [k: string]: string[] } = {};

  constructor(
    public sourceRun: SourceRun,
    public moduleClass: statements.Class
    ) { }

  toString() {
    this.sourceRun.source.fileName + "::" + this.moduleClass.name;
  }

  run = utils.once(() => {
    if (!this.determineBuildTarget()) return;

    if (this.moduleClass.parentClass != null) {
      throw new Error(utils.formatErr(this.moduleClass.node, `pitcher.Modules cannot contain a superclass.`));
    }

    for (var property of this.moduleType.getApparentProperties()) {
      var provider = new Provider(this, property);
      if (!provider.match()) continue;

      provider.ensureValidProperty();
      provider.determineDependencies();
      this.registerProviderLocally(provider);
    }

    this.registerProvidersGlobally();
    this.followIncludes();

    this.checkForGlobalConflicts();
    this.ensureProvidersCanMeetDependencies();
    this.checkForCircularDependencies();

    this.prepareGenerationTargets();
    this.applytoInferredGraph();
    this.applyToModuleGraph();
    this.applyToInstallMethod();
  });

  determineBuildTarget = utils.cachedNonReentrant<boolean>(() => {
    this.sourceRun.analyzer.analyzeBody(this.moduleClass);

    var moduleGraphTypeName = statements.QualifiedTypeName.fromSimpleName(this.moduleGraphName);

    for (var i = 0; i < this.moduleClass.implementedInterfaces.length; ++i) {
      var extendedName = this.moduleClass.implementedInterfaces[i];
      let type = <ts.InterfaceType>this.sourceRun.typechecker.getTypeAtLocation(extendedName.node);
      let program = this.sourceRun.run.analyzerHost.program;
      let heritageClause = <ts.HeritageClauseElement>extendedName.node;

      if (utils.isRuntimeSymbol(type.symbol, "Module", program)) {
        this.pitcherQualification = extendedName.name.qualification;
        this.moduleClass.implementedInterfaces[i] = new statements.QualifiedTypeName(new statements.QualifiedName(
          "Builds", this.pitcherQualification), [moduleGraphTypeName]);
        this.sourceRun.commitChanges(this.moduleClass);
        return true;
      } else if (utils.isRuntimeSymbol(type.symbol, "Builds", program)) {
        this.pitcherQualification = extendedName.name.qualification;
        if (extendedName.typeParameters[0].toString() != this.moduleGraphName) {
          extendedName.typeParameters = [moduleGraphTypeName];
          extendedName.markDirty();
          this.sourceRun.commitChanges(this.moduleClass);
        }
        return true;
      }
    }

    return false;
  });


  private checkForCircularDependencies() {
    for (var providerName in this.localProviders) {
      this.checkDependencies(providerName);
    }
  }

  private checkDependencies(providerName: string, path: string[] = [], seen: string[] = []) {
    path.push(providerName);
    seen.splice(utils.bisect(providerName, seen), 0, providerName);

    // Determine immediate dependencies by taking all the global providers
    // under this name and pushing together their local dependencies.
    var allImmediateDependencies: string[] = [];
    for (var provider of this.allProviders[providerName]) {
      Array.prototype.push.apply(allImmediateDependencies, provider.localDependencies);
    }

    // Sort and remove duplicates.
    allImmediateDependencies = allImmediateDependencies.sort().filter((v, idx, a) => a[idx] != a[idx - 1]);

    // Provide an intermediate value of the immediate dependencies to prevent
    // infinite recursion.  This is safe because if we re-enter the same
    // provider before resolving the entire list of transient dependencies,
    // that means we will find the circular dependency once we unfold to it.
    this.transientDependenciesOf[providerName] = allImmediateDependencies;

    // Now determine global dependencies by finding each immediate dependency's
    // transient ones.
    var allDependencies = allImmediateDependencies.slice(0);
    for (var dependency of allImmediateDependencies) {
      var transientDependencies = this.transientDependenciesOf[dependency];
      if (transientDependencies == null) {
        transientDependencies = this.checkDependencies(dependency, seen.slice(0), path.slice(0));
      }
      Array.prototype.push.apply(allDependencies, transientDependencies);
    }

    // Sort and remove duplicates.
    allDependencies = allDependencies.sort().filter((v, idx, a) => a[idx] != a[idx - 1]);

    if (utils.hasIntersection(allDependencies, seen)) {
      throw new Error(utils.formatErr(
        this.allProviders[providerName][0].propertyDeclaration, "Circular dependency cannot be resolved: " + path.join(" -> ")));
    }

    return this.transientDependenciesOf[providerName] = allDependencies;
  }

  private registerProvidersGlobally() {
    for (var providerName in this.localProviders) {
      let provider = this.localProviders[providerName];
      (this.allProviders[provider.name] = this.allProviders[provider.name] || []).push(provider);
    }
  }

  private checkForGlobalConflicts() {
    for (var providerName in this.localProviders) {
      let provider = this.localProviders[providerName];
      var externalProvider = provider;
      for (externalProvider of (this.allProviders[provider.name] || [])) {
        if (externalProvider != provider) break;
      }
      if (externalProvider != provider) {
        var bothAreCollections = externalProvider.providedKind == provider.providedKind
          && provider.providedKind == ProvidedKind.COLLECTION

        if (!bothAreCollections) {
          throw new Error(utils.formatErr(provider.propertyDeclaration,
            `Provider ${provider.name} conflicts with definition given in included module ${externalProvider.moduleRun.moduleClass.name}`));
        }
      }
    }
  }

  private ensureProvidersCanMeetDependencies() {
    for (var providerName in this.localProviders) {
      var provider = this.localProviders[providerName];
      provider.ensureCanMeetDependencies(this.allProviders);
    }
  }

  private followIncludes() {
    var includesProp = utils.findPropertyByName(this.moduleClass, "includes");
    if (includesProp == null) return;
    if (includesProp.initializer == null) return;
    if (!(includesProp.initializer instanceof statements.ArrayLiteral)) return;

    var includes = <statements.ArrayLiteral>includesProp.initializer;
    this.sourceRun.analyzer.analyzeBody(includes);
    for (var include of includes.elements) {
      // test non qualified name things.
      if (include instanceof statements.Trivia) continue;
      this.localIncludesTypeNames.push(utils.qualifiedNameOfInclude(include));

      var includeType = utils.getSingleDeclarationTypeOf(
        this.sourceRun.typechecker, include.node, utils.ExpectedType.CLASS);

      var sourcePath = includeType.symbol.declarations[0].getSourceFile().fileName;
      var sourceRun = this.sourceRun.run.getSourceRunFor(sourcePath);
      sourceRun.determineModules();
      var moduleRun = sourceRun.modules[includeType.symbol.name];

      if (moduleRun == null) {
        throw new Error(utils.formatErr(include.node,
          `class literal ${includeType.symbol.name} is referenced as an include, but is not a pitcher.Module.`))
      }

      this.allIncludes.push(moduleRun);

      moduleRun.run();

      Array.prototype.push.apply(this.allIncludes, moduleRun.allIncludes);
      if (this.allIncludes.indexOf(this) != -1) {
        throw new Error(utils.formatErr(include.node,
          `circular module includes found.  Module ${includeType.symbol.name} is included by but transiently includes ${this.moduleType.symbol.name}`));
      }

      for (var providerName in moduleRun.allProviders) {
        var providers = moduleRun.allProviders[providerName];
        this.allProviders[providerName] = (this.allProviders[providerName] || []).concat(providers);
      }
    }
  }

  private applyToInstallMethod() {
    if (this.installMethod.node != null)
      this.sourceRun.analyzer.analyzeBody(this.installMethod);

    var installWriter = new InstallWriter(this);

    var proposedArgs = installWriter.buildProposedArgs();
    var proposedBody = installWriter.buildProposedBody();

    var bodyNeedsChanges = !utils.statementsEqual(proposedBody, this.installMethod.elements);
    var signatureNeedsChanges = !utils.statementsEqual(proposedArgs, this.installMethod.callableSignature.args)

    if (signatureNeedsChanges) {
      this.installMethod.callableSignature.args = proposedArgs;
    }

    if (bodyNeedsChanges) {
      this.installMethod.elements = proposedBody;
    }

    if (signatureNeedsChanges || bodyNeedsChanges) {
      this.installMethod.markDirty();
      this.installMethod.callableSignature.markDirty();
      this.sourceRun.commitChanges(this.moduleClass);
    }
  }

  private applyToModuleGraph() {
    var proposedExtends: statements.QualifiedTypeName[] = [
      statements.QualifiedTypeName.fromSimpleName(this.inferredGraphClass.name)
    ];

    for (var name of this.localIncludesTypeNames) {
      proposedExtends.push(
        new statements.QualifiedTypeName(new statements.QualifiedName(
          name.name + "Graph", name.qualification
          ))
        )
    }

    if (utils.statementsEqual(proposedExtends, this.moduleGraphInterface.extendedInterfaces)
      && utils.statementsEqual([], this.moduleGraphInterface.elements)) {
      return;
    }

    this.moduleGraphInterface.extendedInterfaces = proposedExtends;
    this.sourceRun.commitChanges(this.moduleGraphInterface);
  }

  private applytoInferredGraph() {
    var pitcherModuleExpression = this.pitcherQualification.asExpression();
    var modulePrototypeExpression = new statements.PropertyAccess(new statements.Identifier(this.moduleClass.name), "prototype");

    var newStatements: statements.CodeNode[] = [];
    var seenCollections: { [k: string]: boolean } = {};

    var addProperty = (propertyName: string) => {
      var nextProperty: statements.Property;
      newStatements.push(utils.newlineIndentions[1])
      newStatements.push(nextProperty = new statements.Property(new statements.Identifier(propertyName)));
      return nextProperty;
    }

    for (var providerName of this.localProvidersOrdering) {
      var provider = this.localProviders[providerName];

      var providerTypeName: string;
      if (provider.hasGiven) {
        providerTypeName = "Given";
      } else {
        providerTypeName = PROVIDER_TYPE_NAME[provider.providerKind.valueOf()];
      }

      var prototypeProviderExpression =
        new statements.PropertyAccess(modulePrototypeExpression, provider.propertyName())

      addProperty(provider.name + "Provider").initializer = new statements.Call(
        new statements.PropertyAccess(pitcherModuleExpression, "typeOf" + providerTypeName), [prototypeProviderExpression])

      if (provider.providedKind != ProvidedKind.COLLECTION || seenCollections[provider.name]) continue;
      seenCollections[provider.name] = true;

      addProperty(provider.name + "Collection").initializer = new statements.Call(
        new statements.PropertyAccess(pitcherModuleExpression, "collectionTypeOf" + providerTypeName), [prototypeProviderExpression])
    }

    newStatements.push(utils.newlineIndentions[0]);

    if (this.inferredGraphClass.node == null
      || !utils.statementsEqual(newStatements, this.inferredGraphClass.elements)) {
      this.inferredGraphClass.elements = newStatements;
      this.sourceRun.commitChanges(this.inferredGraphClass);
    }
  }

  private prepareGenerationTargets() {
    this.moduleGraphInterface = utils.findInterfaceByName(this.sourceRun.source, this.moduleGraphName);
    this.inferredGraphClass = utils.findClassByName(this.sourceRun.source, this.inferredGraphName);
    this.installMethod = utils.findMethodByName(this.moduleClass, "install");

    if (this.inferredGraphClass == null) {
      this.sourceRun.source.elements.push(utils.newlineIndentions[0]);
      this.sourceRun.source.elements.push(utils.newlineIndentions[0]);
      this.sourceRun.source.elements.push(this.inferredGraphClass = new statements.Class(this.inferredGraphName))
      this.inferredGraphClass.modifiers.push("export");
      this.sourceRun.commitChanges(this.inferredGraphClass);
    }

    if (this.moduleGraphInterface == null) {
      this.sourceRun.source.elements.push(utils.newlineIndentions[0]);
      this.sourceRun.source.elements.push(utils.newlineIndentions[0]);
      this.sourceRun.source.elements.push(this.moduleGraphInterface = new statements.Interface(this.moduleGraphName))
      this.moduleGraphInterface.modifiers.push("export");
      this.sourceRun.commitChanges(this.moduleGraphInterface);
    }

    if (this.installMethod == null) {
      this.moduleClass.elements.push(utils.newlineIndentions[1]);

      this.moduleClass.elements.push(this.installMethod = new statements.Function(
        new statements.CallableSignature(new statements.Identifier("install")),
        [],
        true));
      this.moduleClass.elements.push(utils.newlineIndentions[0]);
      this.sourceRun.commitChanges(this.moduleClass);
    }
  }

  private registerProviderLocally(provider: Provider) {
    var localProvider = this.localProviders[provider.name];

    if (localProvider != null) {
      if (provider.canMergeWith(localProvider)) {
        provider = provider.merge(localProvider);
      } else {
        throw new Error(utils.formatErr(provider.propertyDeclaration,
          `Provider ${provider.property.name} conflicts with existing local ${localProvider.property.name} definition.`));
      }
    }

    this.localProviders[provider.name] = provider;

    if (this.localProvidersOrdering.indexOf(provider.name) == -1)
      this.localProvidersOrdering.push(provider.name);
  }
}

export class InstallWriter {
  moduleGraphInterface = this.moduleRun.moduleGraphInterface;
  pitcherQualification = this.moduleRun.pitcherQualification;
  localIncludesTypeNames = this.moduleRun.localIncludesTypeNames;
  moduleGraphName = this.moduleRun.moduleGraphName;
  localProvidersOrdering = this.moduleRun.localProvidersOrdering;
  localProviders = this.moduleRun.localProviders;
  allProviders = this.moduleRun.allProviders;

  factoryIdents: { [k: string]: statements.Expression } = {};

  static installedIdent = new statements.Identifier("installed");
  static moduleIndentityIdent = new statements.Identifier("moduleIdentity");
  static overrideIdent = new statements.Identifier("override");
  static graphIdent = new statements.Identifier("graph");
  static resolveIdent = new statements.Identifier("resolve");
  static rejectIdent = new statements.Identifier("reject");
  static errIdent = new statements.Identifier("err");
  static resolverSignature = new statements.CallableSignature(null, [
    new statements.Property(new statements.Identifier("_")),
    new statements.Property(InstallWriter.errIdent)
  ]);

  // if (!override && installed[moduleIdentity]) return;
  static alreadyInstalledCheck = new statements.If(
    new statements.BinaryOperation("&&",
      new statements.UnaryOperation("!", InstallWriter.overrideIdent, false),
      new statements.ElementAccess(InstallWriter.installedIdent, InstallWriter.moduleIndentityIdent)),
    new statements.Return());

  // installed[moduleIdentity] = true;
  static markInstalledStatement = new statements.BinaryOperation("=",
    new statements.ElementAccess(InstallWriter.installedIdent, InstallWriter.moduleIndentityIdent),
    new statements.AtomicValue("true"))

  constructor(private moduleRun: ModuleRun) { }

  buildProposedArgs() {
    var proposedArgs: statements.Property[] = [];

    proposedArgs.push(new statements.Property(
      new statements.Identifier("graph"),
      statements.QualifiedTypeName.fromSimpleName(this.moduleGraphName)));
    proposedArgs.push(new statements.Property(
      new statements.Identifier("installed"),
      new statements.QualifiedName("InstalledModules", this.pitcherQualification).asTypeName()));
    proposedArgs.push(new statements.Property(
      new statements.Identifier("override"),
      statements.KeywordType.boolean));

    return proposedArgs;
  }

  buildProposedBody() {
    var proposedBody: statements.CodeNode[] = [];
    proposedBody.push(utils.newlineIndentions[2]);

    // var moduleIdentity = pitcher.identifyModuleBase(this);
    proposedBody.push(statements.VariableDeclaration.forProperty(
      new statements.Property(InstallWriter.moduleIndentityIdent, null,
        new statements.Call(
          utils.propIdentifier([this.pitcherQualification.toString(), "identifyModuleBase"]),
          [utils.propIdentifier(["this"])]))
      ));

    proposedBody.push(utils.newlineIndentions[2]);
    proposedBody.push(InstallWriter.alreadyInstalledCheck);
    proposedBody.push(utils.newlineIndentions[0]);

    proposedBody.push(utils.newlineIndentions[2]);
    proposedBody.push(InstallWriter.markInstalledStatement);
    proposedBody.push(utils.newlineIndentions[0]);

    this.addInstallModuleStatements(proposedBody);
    this.addProviderStatements(proposedBody);

    proposedBody.push(utils.newlineIndentions[1]);
    return proposedBody;
  }

  private addInstallModuleStatements(proposedBody: statements.CodeNode[]) {
    for (var includeName of this.localIncludesTypeNames) {
      proposedBody.push(utils.newlineIndentions[2]);

      // new AnalyzerModule().install(graph, installed, false);
      proposedBody.push(new statements.Call(
        new statements.PropertyAccess(includeName.asTypeName().asNew(), "install"),
        [InstallWriter.graphIdent, InstallWriter.installedIdent, new statements.AtomicValue("false")]));
    }
  }

  private addProviderStatements(proposedBody: statements.CodeNode[]) {
    for (var providerName of this.localProvidersOrdering) {
      var provider = this.localProviders[providerName];
      var graphProviderIdent: statements.Expression;
      var graphCollectionIdent: statements.Expression;

      proposedBody.push(utils.newlineIndentions[0])

      if (provider.providedKind == ProvidedKind.COLLECTION) {
        graphProviderIdent = this.getGraphProviderIdent(provider.name);
        graphCollectionIdent = this.getGraphProviderIdent(provider.name, "Collection");

        proposedBody.push(utils.newlineIndentions[2])
        proposedBody.push(new statements.BinaryOperation("=",
          graphCollectionIdent,
          new statements.BinaryOperation("||",
            graphCollectionIdent,
            new statements.ArrayLiteral())))
      }

      proposedBody.push(utils.newlineIndentions[2])
      proposedBody.push(this.buildProviderExpression(provider));

      if (provider.providedKind == ProvidedKind.COLLECTION) {
        proposedBody.push(utils.newlineIndentions[2])
        proposedBody.push(new statements.If(
          new statements.BinaryOperation("==",
            graphProviderIdent,
            new statements.AtomicValue("null")),
          new statements.BinaryOperation("=",
            graphProviderIdent,
            new statements.Call(
              new statements.Call(
                utils.propIdentifier([this.pitcherQualification.toString(), "collectionProvider"]),
                [graphProviderIdent]),
              [graphCollectionIdent]))));
      }
    }
  }

  private buildProviderExpression(provider: Provider): statements.Expression {
    var graphProviderIdent = this.getGraphProviderIdent(provider.name);
    var inferringMethod = provider.providerKind == ProviderKind.PROVIDER_PROMISED ? "promisedProvider" : "singletonProvider";

    var providerFactory = new statements.Lambda(
      new statements.CallableSignature(null, [
        new statements.Property(InstallWriter.resolveIdent)
      ]))

    var inferenceAndFactory = new statements.Call(
      new statements.Call(
        utils.propIdentifier([this.pitcherQualification.toString(), inferringMethod]),
        [graphProviderIdent]),
      [providerFactory]);

    this.writeProviderImplBody(providerFactory, provider);

    if (provider.providedKind == ProvidedKind.SINGLETON) {
      return new statements.BinaryOperation("=", graphProviderIdent, inferenceAndFactory);
    } else {
      return new statements.Call(
        utils.propIdentifier([
          this.getGraphProviderIdent(provider.name, "Collection").toString(),
          "push"
        ]),
        [inferenceAndFactory]);
    }
  }

  private writeProviderImplBody(func: statements.Lambda, provider: Provider) {
    if (provider.providerKind == null) {
      func.isSingleExpression = true;
      func.elements.push(new statements.Call(
        InstallWriter.resolveIdent,
        [utils.propIdentifier(["this", provider.propertyName()])]))
      return;
    }

    if (provider.hasGiven) {
      var givenIdentity = utils.propIdentifier(["this", provider.propertyName()]);

      func.elements.push(utils.newlineIndentions[3]);
      func.elements.push(new statements.If(
        new statements.BinaryOperation(
          "!==",
          givenIdentity,
          new statements.AtomicValue("undefined")),
        utils.block([
          new statements.Call(
            InstallWriter.resolveIdent,
            [givenIdentity]),
          new statements.Return()
        ])))

      func.elements.push(utils.newlineIndentions[0]);
    }

    if (provider.localDependencies.length == 0) {
      func.elements.push(utils.newlineIndentions[3]);
      func.elements.push(new statements.Call(
        InstallWriter.resolveIdent, [
          this.wrapProviderInvocation(provider,
            new statements.Call(
              utils.propIdentifier(["this", provider.propertyName(false)]))
            )]));
      func.elements.push(utils.newlineIndentions[2]);
      return;
    } else {
      func.callableSignature.args.push(new statements.Property(InstallWriter.rejectIdent));
    }

    for (var depName of provider.localDependencies) {
      var graphProvIdent = this.getGraphProviderIdent(depName);

      func.elements.push(utils.newlineIndentions[3]);
      func.elements.push(statements.VariableDeclaration.forProperty(
        new statements.Property(
          new statements.Identifier(depName),
          null,
          new statements.Call(utils.propIdentifier([graphProvIdent.toString(), "get"])))))
    }

    func.elements.push(utils.newlineIndentions[0]);
    func.elements.push(utils.newlineIndentions[3]);

    var resolverLambda = new statements.Lambda(InstallWriter.resolverSignature);
    this.writeResolverBody(resolverLambda, provider);

    func.elements.push(new statements.Call(
      utils.propIdentifier([this.pitcherQualification.toString(), "awaitAll"]),
      [utils.arrayLiteral(
        provider.localDependencies.map<statements.Expression>(
          d => new statements.ElementAccess(
            utils.propIdentifier([d]), new statements.AtomicValue("2"))
          )
        ),
        resolverLambda
      ]))
    func.elements.push(utils.newlineIndentions[2]);
  }

  private wrapProviderInvocation(provider: Provider, call: statements.Call): statements.Expression {
    if (provider.classConstruction) {
      return new statements.New(call);
    }

    return call;
  }

  private writeResolverBody(func: statements.Lambda, provider: Provider) {
    var args = provider.localDependencies.map<statements.Expression>(
      d => new statements.ElementAccess(
        utils.propIdentifier([d]), new statements.AtomicValue("0")));

    var resolveResult = this.wrapProviderInvocation(provider,
      new statements.Call(
        utils.propIdentifier(["this", provider.propertyName(false)]), args));

    if ([ProviderKind.FACTORY_CLASS, ProviderKind.FACTORY_METHOD].indexOf(provider.providerKind) != -1) {
      var factory = new statements.Lambda(new statements.CallableSignature(null));
      factory.elements.push(utils.newlineIndentions[5]);
      factory.elements.push(new statements.Return(resolveResult));
      factory.elements.push(utils.newlineIndentions[4]);
      resolveResult = factory;
    }

    func.elements.push(utils.newlineIndentions[4]);
    func.elements.push(new statements.TernaryOperation(["?", ":"], [
      InstallWriter.errIdent,
      new statements.Call(InstallWriter.rejectIdent, [InstallWriter.errIdent]),
      new statements.Call(InstallWriter.resolveIdent, [resolveResult])
    ]));
    func.elements.push(utils.newlineIndentions[3]);
  }

  private getGraphProviderIdent(providerName: string, type = "Provider") {
    return this.factoryIdents[providerName + type] = this.factoryIdents[providerName] ||
      utils.propIdentifier([InstallWriter.graphIdent.toString(), providerName + type])
  }
}

export class RunResult {
  output: { [outFile: string]: SourceRun } = {};
  sourceFileNames: string[] = [];

  constructor(private outputDir: string, private srcDir: string) {
  }

  outPathFor(fileName: string) {
    return this.outputDir + path.relative(this.srcDir, fileName);
  }

  add(run: SourceRun) {
    var outFileName = this.outPathFor(run.source.fileName);
    this.output[outFileName] = run;
    if (this.sourceFileNames.indexOf(run.source.fileName) == -1)
      this.sourceFileNames.push(run.source.fileName);
  }

  contains(src: statements.Source) {
    return !!this.output[this.outPathFor(src.fileName)];
  }

  writeChanges(): Promise<any> {
    return new Promise<any>((resolve: () => void, reject: (e: any) => void) => {
      var promises: Promise<any>[] = [];
      for (var outFile in this.output) {
        var run = this.output[outFile];
        if (!run.writable) {
          throw new Error(utils.formatErr(run.source.node,
            `Included module requires editing, but was not part of moduleSources.`));
        }

        promises.push(utils.writeFile(outFile, run.source.toString()));
      }

      Promise.all(promises).then(resolve, reject);
    })
  }
}
