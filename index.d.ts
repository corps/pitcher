/**
  The pitcher runtime library.  In most cases this is all you need to reference.
*/
declare module "pitcher" {
  import tmp = require("lib/runtime");
  export = tmp;
}

/**
  Longer, more explicit module name for the runtime.
*/
declare module "pitcher/lib/runtime" {
  import tmp = require("lib/runtime");
  export = tmp;
}
