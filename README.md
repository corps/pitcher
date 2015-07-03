# pitcher
Code-Generated, Typescript Dependency Injection inspired by Dagger and Angular 1.x.

* [I've used DI before, why pitcher?](#why-pitcher?)
* [I've never used DI before, what is it?](#what-is-di?)

## Setup
```
npm install typescript@1.5.0-beta --save
npm install pitcher --save
```

TODO

## Why Pitcher?
1.  `pitcher` uses code generation to wire your singletons together, inspired by [Dagger](http://square.github.io/dagger/).  
2.  As a result of #1, `pitcher` is able to statically analyze any missing or circular dependencies and tell you immediately when something has gone awry.
3.  As a result of #1, any errors or stack traces produced by `pitcher` are shallow and readable. `pitcher`'s runtime layer is extremely thin, leaving your business logic more visible.
4.  `pitcher` supports `Promise` backed async dependencies.  Great for globbing files or running other processes before your main app is ready!
5.  Setup is dead simple.  No decorators or heavy manual configuration, just define a class and use naming conventions to tie together dependencies.
6.  Oh, and did we mention?  Because of #1, your dependencies benefit from static type checking, too! :o)

## What is DI?

In short, **Dependency Injection is the management of global singletons**.

There's several ways to define DI but the ultimate goal is to manage any "shared software resource" in a way that it can be isolated, replaced, or mocked in tests.  

TODO.  I'd love to demonstrate this concept in greater detail.
