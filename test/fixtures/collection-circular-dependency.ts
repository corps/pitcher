import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  includes = [ModuleA, ModuleC];

  contributesA(c: number): number[] {
    return [c];
  }
}

export class ModuleA implements pitcher.Module {
  includes = [ModuleB];

  contributedA = [1, 2, 3];
  contributesB(d: number, e: number) {
    return [d, e];
  }
  providedD = 4;
}

export class ModuleB implements pitcher.Module {
  contributesA() {
    return [9, 10];
  }

  providesE(a: number[]) {
    return a[a.length - 1];
  }
}


export class ModuleC implements pitcher.Module {
  contributedB = [99];

  providesC(b: number[]) {
    return b[0];
  }
}
