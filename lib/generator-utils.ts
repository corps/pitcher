import { statements } from "tscripter";
import Promise = require("bluebird");
import fs = require("fs");
import path = require("path");
import ts = require("typescript");

var _writeFile: (fileName: string, data: any) => Promise<any> = Promise.promisify(fs.writeFile);
var _mkdir: (filepath: string) => Promise<any> = Promise.promisify(fs.mkdir);

/**
  Attempt to make directories until the full path filePath exists, similar to
  mkdir -p.
*/
function mkdir(filePath: string): Promise<any> {
  return _mkdir(filePath).catch((e) => {
    if (e.code == "EEXIST") return;
    else if (e.code == "ENOENT")
      return mkdir(path.dirname(filePath)).then(() => mkdir(filePath));
    else throw e;
  });
}

/**
  Writes the given data to the given fileName, creating any necessary
  directories along the way.
*/
export function writeFile(fileName: string, data: any): Promise<any> {
  return mkdir(path.dirname(fileName)).then(() => {
    return _writeFile(fileName, data);
  });
}

export enum ExpectedType {
  CLASS = ts.SyntaxKind.ClassDeclaration.valueOf(),
  INTERFACE = ts.SyntaxKind.InterfaceDeclaration.valueOf()
}

const EXPECTED_TYPE_NAMES: { [k: number]: string } = {};
EXPECTED_TYPE_NAMES[ExpectedType.CLASS] = "Class";
EXPECTED_TYPE_NAMES[ExpectedType.INTERFACE] = "Interface";

/**
  Handles searching for the type declaration of a given ts.Node given
  an expected type (either class or Interface) and expected source file,
  throwing an error if either multiple declarations are found, or
  if the expectations of the type are not met.
*/
export function getSingleDeclarationTypeOf(
  typechecker: ts.TypeChecker,
  node: ts.Node,
  expectedType: ExpectedType,
  expectedSource?: statements.Source
  ) {
  var type = typechecker.getTypeAtLocation(node);

  var declarations = type.symbol.declarations;
  if (declarations.length != 1) {
    throw new Error(formatErr(node, "pitcher can only process non merged, non ambient, single declaration types."));
  }

  if (!(declarations[0].kind & expectedType)) {
    throw new Error(formatErr(node, "Expected to find a " + EXPECTED_TYPE_NAMES[expectedType] + " type"))
  }

  if (expectedSource != null && declarations[0].getSourceFile().fileName != expectedSource.fileName) {
    throw new Error(formatErr(node, "Types that are external to the current module are not allowed"));
  }

  return type;
}

/**
  Formats errors produced by pitcher to include source file details.
*/
export function formatErr(node: ts.Node, msg: string) {
  var source = node.getSourceFile();
  var start = node.getStart(source);
  var lnc = source.getLineAndCharacterOfPosition(start);
  return source.fileName + "(" + lnc.line + "," + lnc.character + "): " + msg;
}

export function findMethodByName(klass: statements.Class, methodName: string): statements.Function {
  for (var s of klass.elements) {
    if (s instanceof statements.Function) {
      if (s.callableSignature.name instanceof statements.Identifier) {
        let ident = <statements.Identifier>s.callableSignature.name;
        if (ident.token == methodName) return s;
      }
    }
  }
}

export function findClassByName(source: statements.Source, name: string): statements.Class {
  for (var s of source.elements) {
    if (s instanceof statements.Class) {
      if (s.name == name) return s;
    }
  }
  return undefined;
}


export function findInterfaceByName(source: statements.Source, name: string): statements.Interface {
  for (var s of source.elements) {
    if (s instanceof statements.Interface) {
      if (s.name == name) return s;
    }
  }
  return undefined;
}

export function findPropertyByName(klass: statements.Class, name: string): statements.Property {
  for (var s of klass.elements) {
    if (s instanceof statements.Property) {
      if (s.name instanceof statements.Identifier) {
        if (s.name.text == name) return s;
      }
    }
  }
  return undefined;
}

/**
  Compares statement.CodeNode[]'s by comparing their toString while ignoring any
  Trivia.
*/
export function statementsEqual(s1: statements.CodeNode[], s2: statements.CodeNode[]) {
  s1 = s1.filter(s => !(s instanceof statements.Trivia));
  s2 = s2.filter(s => !(s instanceof statements.Trivia));

  var len = s1.length;
  if (len != s2.length) return false;
  for (var i = 0; i < len; ++i) {
    if (s1[i].toString() != s2[i].toString()) {
      return false;
    }
  }
  return true;
}

/**
  Used by pitcher to determine if the given symbol matches the runtime environment's
  respective pitcher symbol named by name.
*/
export function isRuntimeSymbol(symbol: ts.Symbol, name: string, program: ts.Program) {
  if (symbol == null) return false;
  if (symbol.name != name) return false;

  var declarations = symbol.declarations;
  if (declarations.length != 1) return false;

  var sourceFileName = declarations[0].getSourceFile().fileName;
  sourceFileName = path.join(program.getCurrentDirectory(), sourceFileName);
  return sourceFileName.indexOf(__dirname) == 0;
}

export function qualifiedNameOfInclude(expression: statements.CodeNode): statements.QualifiedName {
  if (expression instanceof statements.PropertyAccess) {
    var qualification: statements.QualifiedName = null;
    if (expression.expression != null) {
      qualification = qualifiedNameOfInclude(expression.expression);
    }
    return new statements.QualifiedName(expression.property, qualification);
  } else if (expression instanceof statements.Identifier) {
    return new statements.QualifiedName(expression.token);
  } else {
    throw new Error(formatErr(expression.node, "includes elements must be literal identifiers of pitcher.Module / Builds constructors."));
  }
}

/**
  Gates a function to being invoked only once.  Further calls will be no-ops.
*/
export function once(func: () => void): () => void {
  var called = false;
  return (() => {
    if (called) return;
    called = true;
    func();
  });
}

/**
  Caches the result of a function to prevent re-execution while preventing
  re-entry to the method during invocation.
*/
export function cachedNonReentrant<T>(func: () => T): () => T {
  var result: T;
  var called = false;
  var finished = false;
  return (): T => {
    if (called) {
      if (!finished) throw new Error("Non Reentrant constraint broken.  Likely bug in pitcher.");
      return result;
    }
    called = true;
    try {
      return result = func();
    } finally {
      finished = true;
    }
  }
}

export function propIdentifier(parts: string[]): statements.Expression {
  var result: statements.Expression;
  for (var part of parts) {
    if (result == null) result = new statements.Identifier(part);
    else result = new statements.PropertyAccess(result, part);
  }
  return result;
}

export function block(body: statements.CodeNode[]): statements.CodeBlock {
  var result = new statements.CodeBlock();
  result.elements = body;
  return result;
}

export function arrayLiteral(body: statements.CodeNode[]): statements.ArrayLiteral {
  var result = new statements.ArrayLiteral();
  result.elements = body;
  return result;
}

/**
  Checks for intersection between a and b assuming both are pre-sorted.
*/
export function hasIntersection(a: string[], b: string[]) {
  var i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] == b[i]) return true;
    if (a[i] < b[i]) i++;
    else j++;
  }
  return false;
}

export function bisect(v: string, a: string[]) {
  var length = a.length, l = 0, r = length;
  if (length == 0) return 0;

  while (l < r) {
    var m = l + r >>> 1;
    if (a[m] < v) {
      l = m + 1;
    } else {
      r = m;
    }
  }

  return l;
}

export var newlineIndentions = [
  new statements.Trivia("\n"),
  new statements.Trivia("\n  "),
  new statements.Trivia("\n    "),
  new statements.Trivia("\n      "),
  new statements.Trivia("\n        "),
  new statements.Trivia("\n          ")
];
