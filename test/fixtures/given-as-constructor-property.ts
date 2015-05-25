import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  constructor(public providedTheSecretKey:number) {
    this.providedTheSecretKey = 15;
  }
}
