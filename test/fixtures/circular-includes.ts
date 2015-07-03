import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  includes = [ SubModuleA ];

  providesHead() {
    return "head";
  }

  providesLowerbody(legs:string) {
    return legs + "+waits";
  }
}

export class SubModuleA implements pitcher.Module {
  includes = [ SubModuleB ];
}

export class SubModuleB implements pitcher.Module {
  includes = [ Module ];

  providesLegs() {
    return "legs";
  }

  providesUpperbody(head:string) {
    return "chest+" + head;
  }

  providesBody(lowerbody:string, upperbody:string) {
    return lowerbody + "+" + upperbody;
  }
}
