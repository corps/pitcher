import { statements } from "tscripter";
import Promise = require("bluebird");
import ts = require("typescript");
/**
  Writes the given data to the given fileName, creating any necessary
  directories along the way.
*/
export declare function writeFile(fileName: string, data: any): Promise<any>;
export declare enum ExpectedType {
    CLASS,
    INTERFACE,
}
/**
  Handles searching for the type declaration of a given ts.Node given
  an expected type (either class or Interface) and expected source file,
  throwing an error if either multiple declarations are found, or
  if the expectations of the type are not met.
*/
export declare function getSingleDeclarationTypeOf(typechecker: ts.TypeChecker, node: ts.Node, expectedType: ExpectedType, expectedSource?: statements.Source): ts.Type;
/**
  Formats errors produced by pitcher to include source file details.
*/
export declare function formatErr(node: ts.Node, msg: string): string;
export declare function findMethodByName(klass: statements.Class, methodName: string): statements.Function;
export declare function findClassByName(source: statements.Source, name: string): statements.Class;
export declare function findInterfaceByName(source: statements.Source, name: string): statements.Interface;
export declare function findPropertyByName(klass: statements.Class, name: string): statements.Property;
/**
  Compares statement.CodeNode[]'s by comparing their toString while ignoring any
  Trivia.
*/
export declare function statementsEqual(s1: statements.CodeNode[], s2: statements.CodeNode[]): boolean;
/**
  Used by pitcher to determine if the given symbol matches the runtime environment's
  respective pitcher symbol named by name.
*/
export declare function isRuntimeSymbol(symbol: ts.Symbol, name: string, program: ts.Program): boolean;
export declare function qualifiedNameOfInclude(expression: statements.CodeNode): statements.QualifiedName;
/**
  Gates a function to being invoked only once.  Further calls will be no-ops.
*/
export declare function once(func: () => void): () => void;
/**
  Caches the result of a function to prevent re-execution while preventing
  re-entry to the method during invocation.
*/
export declare function cachedNonReentrant<T>(func: () => T): () => T;
export declare function propIdentifier(parts: string[]): statements.Expression;
export declare function block(body: statements.CodeNode[]): statements.CodeBlock;
export declare function arrayLiteral(body: statements.CodeNode[]): statements.ArrayLiteral;
/**
  Checks for intersection between a and b assuming both are pre-sorted.
*/
export declare function hasIntersection(a: string[], b: string[]): boolean;
export declare function bisect(v: string, a: string[]): number;
export declare var newlineIndentions: statements.Trivia[];
