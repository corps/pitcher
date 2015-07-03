import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  providesValue() {
    return "default";
  }
  providedValue: string;

  constructor(value?: string) {
    this.providedValue = value;
  }
}
