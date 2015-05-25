import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  includes = [ModuleA];

  providesDoDad(thing: number, blah: string) {
  }
}

export class ModuleA implements pitcher.Module {
  providedThing = 2;
}
