# pitcher

Code-generated, type-strong dependency injection for typescript.  
Pour yourself a delicious glass of sweet, sweet dependencies.

* [Introduction](#introduction)
* [Setup](#setup)
* [Usage](#usage)
* [Generator Integration Setup](#advanced-setup)

## Introduction

Inspired by the DI tools of [angular 1.x](https://docs.angularjs.org/guide/di) and [Dagger](http://square.github.io/dagger/), pitcher aims to be the best of the two approaches: code generation for early error checking, and argument names as convention for simple configuration.

Setup is similar to angular -- Let's create a "module" class that provides an instance of a `CoffeePump` service. 

```typescript
class CoffeeModule implements pitcher.Module {
  providesCoffeePump = CoffeePump;
}
```

In this case, CoffeePump is some class we want to construct a singleton for.  We can add a dependency on a `Thermosiphon` by simply declaring it as an argument of said class's constructor.  Pitcher will match the name of the argument to a provider of the same name.

```typescript
class CoffeePump {
  constructor(public thermosiphon:Thermosiphon) {}
}

class ThermosiphonModule implements pitcher.Module {
  providesThermosiphon() { return new Thermosiphon(); }
}
```

Unlike angular, however, these "dependencies as arguments" will work even through code obfuscation.  You also get *strong typing*, *early graph verification*, and best of all **super simple stack traces** thanks to code generation.

## Setup
```
npm install pitcher --save
```

If you are using [tsd](https://github.com/DefinitelyTyped/tsd), you can then `tsd link` to add pitcher's .d.ts file to your project.  If not, you'll need to add a reference to `index.d.ts` directly to your project.

**pitcher currently only supports typescript >= 1.5.0-beta**, requiring the improved type inference for the resulting code.

## Usage

#### Quick Demo
* Create a module
```typescript
  import pitcher = require("pitcher");

  interface Endpoint {
    ():string
  }

  class Server {
    constructor(public endpoints:Endpoint[]) {}
  }

  export class AppModule implements pitcher.Module {
    constructor(public providedEnv = "development") {}

    providesServer = Server;

    contributesEndpoints(appName:string, env:string) {
      return [
        () => "Hello world, this is " + appName + " running in " + env + "!";
      ];
    }
  }
```

*  Add pitcher config to `tsconfig.json` to identify where modules are located.

   ```json
   {
     "pitcher": {
       "moduleGlob": "modules/*.ts"
     }
   }
   ```

*  Run pitcher

   ```bash
   node_modules/.bin/pitcher
   ```

*  Construct your object graph:

  ```typescript
  import pitcher = require("pitcher");
  import { AppModule } from"modules/app";

  pitcher.build(new AppModule()).serverProvider.get((server, err) => {
      server.endpoints.forEach((e) => e());
  })
  ```

#### Long Explanation

See the [github wiki](http://github.com/corps/pitcher/wiki) for documentation, or check the repo for examples.

## Advanced Setup

In order to run the generator programmatically, you'll need to reference the `generator.d.ts` **which is not linked with `tsd link` by default**.

You will also need to reference  `typescript.d.ts`, which you can obtain in the bin directory of typescript itself.  **You do not need this to use pitcher normally**.
