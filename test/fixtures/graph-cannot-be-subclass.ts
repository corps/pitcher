import pitcher = require("../../lib/runtime");

export class ModuleParentClass {}

export class Module extends ModuleParentClass implements pitcher.Module {
  providesTrivialThing() { return 1; }
}
