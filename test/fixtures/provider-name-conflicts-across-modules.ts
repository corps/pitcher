import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  includes = [OtherModule];

  providesPie() {
    return "peach";
  }
}

export class OtherModule implements pitcher.Module {
  contributesPie() {
    return ["apple"];
  }
}
