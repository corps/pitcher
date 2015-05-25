import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  get providedValue() { return ""; }
  set providedValue(a:string) { }
}
