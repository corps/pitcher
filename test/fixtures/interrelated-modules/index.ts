import pitcher = require("../../../lib/runtime");
import sub = require("./sub");

export class Module implements pitcher.Module {
  static constructedCount = 0;
  contributedConstructorCount = [Module.constructedCount += 1];

  includes = [Sibling, sub.Module, sub.SiblingB];
}

export class NotAModule {
}

export class Sibling implements pitcher.Module {
  static constructedCount = 0;
  contributedConstructorCount = [Sibling.constructedCount += 1];

  includes = [sub.SiblingA, sub.Module]
}
