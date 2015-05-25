/**
  The pitcher runtime library.  In most cases this is all you need to reference.
*/
declare module "pitcher" {
  export * from "lib/runtime";
}

/**
  Includes RunResult and SourceRun amongst other things, useful when integrating
  directly with pitcher oneself.
*/
declare module "pitcher/lib/generator" {
  export * from "lib/generator";
}

/**
  Longer, more explicit module name for the runtime.
*/
declare module "pitcher/lib/runtime" {
  export * from "lib/runtime";
}

/**
  Module for producing runs explicitly.  Follow the bin/pitcher example for
  usage examples.
*/
declare module "pitcher/modules/run" {
  export * from "modules/run";
}

/**
  Module for configuring the tscripter analyzer used for source manipulation
  in code gen runs.  See bin/pitcher for example usages.
*/
declare module "pitcher/modules/analyzer" {
  export * from "modules/analyzer"
}
