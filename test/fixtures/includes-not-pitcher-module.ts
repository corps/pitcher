import pitcher = require("../../lib/runtime");

export class NotAModule {}

export class Module implements pitcher.Module {
  public providedValue = "hi";
  includes = [NotAModule];
}
