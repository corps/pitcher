import pitcher = require("../../../lib/runtime");

export class Module implements pitcher.Module {
  static constructedCount = 0;
  contributedConstructorCount = [Module.constructedCount += 1];

  includes = [SiblingA, SiblingB]
}

export class AlsoNotAModule {
}

export class SiblingA implements pitcher.Module {
  static constructedCount = 0;
  contributedConstructorCount = [SiblingA.constructedCount += 1];
}

export class SiblingB implements pitcher.Module {
  static constructedCount = 0;
  contributedConstructorCount = [SiblingB.constructedCount += 1];

  includes = [SiblingA]
}
