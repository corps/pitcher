import pitcher = require("../../lib/runtime");

class NoConstructor {
  a = 1;
}

export class Module implements pitcher.Module {
  providesNoConstructor = NoConstructor;
}
