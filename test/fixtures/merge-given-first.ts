import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  providedValue: string;
  providesValue() {
    return "default";
  }

  constructor(value?: string) {
    this.providedValue = value;
  }
}
