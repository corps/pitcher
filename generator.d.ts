/**
  Includes RunResult and SourceRun amongst other things, useful when integrating
  directly with pitcher oneself.
*/
declare module "pitcher/lib/generator" {
  import tmp = require("lib/generator");
  export = tmp;
}

/**
  Module for producing runs explicitly.  Follow the bin/pitcher example for
  usage examples.
*/
declare module "pitcher/modules/run" {
  import tmp = require("modules/run");
  export = tmp;
}

/**
  Module for configuring the tscripter analyzer used for source manipulation
  in code gen runs.  See bin/pitcher for example usages.
*/
declare module "pitcher/modules/analyzer" {
  import tmp = require("modules/analyzer");
  export = tmp;
}
