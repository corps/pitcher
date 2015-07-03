import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  providesPie() {
    return "peach";
  }

  contributesPie() {
    return ["apple"];
  }
}
