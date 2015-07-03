import pitcher = require("../../lib/runtime");

declare function weaveCape(magicString: string):{};
declare function weaveCape():{};

export class Module implements pitcher.Module {
  providesMagicCape = weaveCape;
}
