import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  includes = [ModuleA];

  contributesDoDad(thing: number, blah: string): number[] {
    return [];
  }
}

export class ModuleA implements pitcher.Module {
  providedThing = 2;
  contributedDoDad: number[] = [];
}
