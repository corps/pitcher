import pitcher = require("../../lib/runtime");

export class Module implements pitcher.Module {
  get providesMagic() {
    return (specialSomething:string) => { return "ho" + specialSomething; };
  }

  providedSpecialSomething = "!";
}
