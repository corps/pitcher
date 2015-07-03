# pitcher

Pour yourself a delicious glass of sweet, sweet dependencies.

* [Setup](#setup)
* [Usage](#usage)
* [Generator Integration Setup](#advanced-setup)
* [I've used DI before, why pitcher?](#why-pitcher)
* [I've never used DI before, what is it?](#what-is-di)

## Setup
```
npm install pitcher --save
```

If you are using [tsd](https://github.com/DefinitelyTyped/tsd), you can then `tsd link` to add pitcher's .d.ts file to your project.  If not, you'll need to add a reference to `index.d.ts` directly to your project.

## Usage

#### Quick Demo
* Create a module
```typescript
  // modules/app.ts
  import pitcher = require("pitcher");

  class Server {
    constructor(endpoints:Endpoints[]) {}
  }

  export class AppModule implements pitcher.Module {
    constructor(public providedEnv = "development") {}

    providesServer = Server;

    providesAppName = () => {
      return pitcher.promised(determineAppNameAsync());
    }

    providedCoolness = (env:string) => {
      new CoolEndpoint(env, true);
    }

    contributesEndpoints(coolness:Endpoint, appName:string) {
      return [
        coolness,
        new Endpoint(() => "Hello, my name is " + appName)
      ];
    }
  }
```

*  Add pitcher config to `tsconfig.json`

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
  pitcher.build(new AppModule()).serverProvider.get((server, err) => {
      console.log(server.endpoints);
  })
  ```

#### Long Explanation

pitcher works on the concept of "Modules" very similar to the kind of "modules" you use when you `require()`.  Except, instead of defining classes or logic, pitcher Modules define providers which can depend on and construct singleton instances.

By making this distinction and explicitly defining constructors for singletons, we can do several things that are typically hard for singletons:

1.  Reset their state dependably by simply recreating them and their dependencies
2.  Mock / replace their dependencies
3.  Have multiple "singletons" coexisting simultaneously.

To define a new "Module", simply create a new class and declare it to implement pitcher.Module.

```typescript
// example/modules/logger.ts
import pitcher = require("pitcher");

export class Module implements pitcher.Module {
}
```

Now, let's suppose we have the follow Logger class that describes the service we want our module to be able to construct:

```
export class Logger {
  constructor(
    private handlers: Handler[],
    private format: string,
    private curTimeF: () => Date) {
  }
}
```

We tell our new Module to build this singleton for us by simply providing the constructor as a property of the class.

```typescript
export class Module implements pitcher.Module {
  providesLogger = Logger;
}
```

pitcher relies on naming conventions to describe provider configurations.  The first part, "provides", simply tells pitcher that we're creating a singleton using a callable.  The second part of the name, "Logger", tells pitcher the name of singleton that is being provided, "logger".

That being said, looks like we need to define the providers that tell pitcher what "handlers", "format", and "curTimeF" are.  Assume the following declarations are inside the Module class.

```
providedCurTimeF = () => new Date()
```

This time, we used the word "provided" as opposed to "provides".  In this case, pitcher will given the value we provide "as is", without constructing it.

In other words, the above is a less verbose equivalent to this:

```
providesCurTimeF = () => () => new Date()
```

It is most useful for singletons that do not have state or other dependencies.

Next, let's explain the "format" singleton.  But wait... format
should be configurable, right?  Although it is a dependency of Logger, it isn't something we "construct", it gets provided or configured.  Well, one solution to this to simply provide the value as property parameter to our constructor itself:

```
export class Module implements pitcher.Module {
  constructor(
    public providedFormat: string = "{level}:{time} {line}"
  ) { }

  ...
}
```

Here, we're declaring a property `providedFormat` and setting it from the first argument to the constructor call, and giving a nice default.  It's also important to note that **all providers in a pitcher.Module must be public**.  

When we go create our object graph from our modules later on, we can simply instantiate the value with our configuration.  

Cool, so how about those "handlers" the Logging service needs?   Well, we could do something like this:

```
providesHandlers() { return [console.log]; }
```

But that doesn't feel right... We want our Logging service to be generic, and leave the configuration of Handlers to the business logic, but we don't want to have manually provide all of the handlers into our module constructor either.

 It's interesting to note that most mature logging systems employ a type of *inversion of control* by allowing specialized handlers to "register themselves" independent of the the logging service's configuration itself.  We can perform a similar function ourselves by leveraging "collections".

```
contributedHandlers:Handler[] = []
```

As before, the "contributed" prefix here is indicating special information about this provider.  In this case, "contribute" tells pitcher that we expect the value to not be defined once, but **be definable in multiple places**.   It means we can have a module that describes our Logging service, **and separate modules that each define handlers**.  For each module that defines a "contributes" or "contributed" provider with the same name, the resulting arrays are concatenated together in the final graph.  This is similar to `Set` providers from dagger.

So let's take advantage of that by defining a new module that will "contribute" a handler to our logging system.

```typescript
// example/modules/console-logger.ts

import pitcher = require("pitcher");
import logger = require("./logger");

export class Module implements pitcher.Module {
  includes = [logger.Module];

  contributesHandlers():logger.Handler[] {
    return [new ConsoleHandler()];
  }
}
```

In this case, we've "included" the `logger.Module`, thus making accessible all of its providers inside of our new Module.  Normally, **if two modules that are included together provide the same named singleton, an error occurs**.  An example would be if our new Module declared

```
providesFormat() { return "my format!"; }
```

It would conflict with the `providedFormat` of the logger.Module.  However, this is not the case of ```contributes``` and ```contributed```.  Instead, the array values from both modules will be concatenated together and provided to the Logging service.  This is our "inversion of control" that allows us to hook specialized code into generic components via DI.  

It's also worth noting that our new console-logger's Module does not have to include the `logger.Module` itself.  A 3rd, separate module, could include both the console-logger's Module and the logger Module, and the handlers would still collaborate.  

In addition to these basic features, pitcher allows for async Promise-backed dependencies and a convenience wrapper for generating factories.  While writing a more in depth tutorial is high priority for me in the coming months, you can learn alot about pitcher by checking out the `example` directory of the repo, or even checking out the `modules/` directory of pitcher itself!  Questions, of course, are always welcome on the [github issues page](https://github.com/corps/pitcher/issues)

## Advanced Setup

In order to run the generator programmatically, you'll need to reference the `generator.d.ts` **which is not linked with `tsd link` by default**.

You will also need to reference  `typescript.d.ts`, which you can obtain in the bin directory of typescript itself.  **You do not need this to use pitcher normally**.

## Why Pitcher?
1.  pitcher uses code generation to wire your singletons together, inspired by [Dagger](http://square.github.io/dagger/).  
2.  As a result of #1, pitcher is able to statically analyze any missing or circular dependencies and tell you immediately when something has gone awry.
3.  As a result of #1, any errors or stack traces produced by pitcher are shallow and readable. pitcher's runtime layer is extremely thin, leaving your business logic more visible.
4.  pitcher supports Promise backed async dependencies.  Great for globbing files or running other processes before your main app is ready!
5.  Setup is dead simple.  No decorators or heavy manual configuration, just define a class and use naming conventions to tie together dependencies.
6.  Oh, and did we mention?  Because of #1, your dependencies benefit from static type checking, too! :o)

## What is DI?

In short, **Dependency Injection is the management of global singletons**.  Plus inversion of control, but you know.  So like

1.  `require("webserver").addHandler(this)` is Inversion of Control.  Your business logic is receiving control by the generic, reusable webserver component.
2.  `require("commander").option('-j, --jazz')` is a global singleton.  No matter where you require commander from, you get the same instance per process.

So Dependency Injection is alot like require.  However, where as `require`'s job is to load code, DI's job is to *isolate* singleton instances so that you can replace them at will.

It's possible through module hacks to change `require("commander")` to give you a different, mocked commander for testing without using DI.  But it's not (portably, maintainably) possible to change the value of, say, the singleton `require("fs")` to be a mock in your program, but the actual filesystem resource in your test harness running your program at the same time.

Dependency Injection simply gives you the ability to build an "Object Graph" of these `require` like singleton resources in a flexible, configurable way.
