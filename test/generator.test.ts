
import assert = require("assert");
import generator = require("../lib/generator");
import pitcher = require("../lib/runtime");
import { Module, ModuleGraph } from "../modules/run";
import fs = require("fs");
import * as ts from "typescript";
import path = require("path");
import utils = require("../lib/generator-utils");
import Promise = require("bluebird");

var reloadExpected = false;

interface AnyBuildsConstructor {
  new (...args: any[]): pitcher.Builds<any>
}

// Used to clean up built directory on each run.
function cleanDir(path: string) {
  if (fs.existsSync(path)) {
    var files = fs.readdirSync(path);
    files.forEach(function (file, index) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        cleanDir(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

describe("generator.Run", () => {
  before(() => { cleanDir("test/built") })
  var result: generator.RunResult;
  var ModuleClasses: { [fileName: string]: AnyBuildsConstructor };
  var failure: any;
  var compilerOptions: ts.CompilerOptions;
  var projectFiles: string[];
  var runSrcDir: string;
  var runOutputDir: string;

  function runGenerator(
    moduleFileNames: string[],
    done: (e?: any) => void,
    moduleGlob?: string,
    srcDir: string = "test/fixtures/",
    outputDir: string = "test/built/"
    ) {

    failure = null;
    result = null;
    compilerOptions = null;
    ModuleClasses = {};
    projectFiles = [];
    runSrcDir = srcDir;
    runOutputDir = outputDir;

    var graph = pitcher.build(new Module({
      moduleFiles: moduleFileNames.map((n) => path.join(srcDir, n)),
      moduleSrcDir: srcDir,
      moduleOutputDir: outputDir,
      strictMode: true,
      moduleGlob: moduleGlob
    }));

    graph.runProvider.get((run, err) => {
      if (err) done(err);

      compilerOptions = graph.tsProgramProvider.get()[0].getCompilerOptions();
      projectFiles = graph.projectConfigProvider.get()[0].fileNames;

      run().then(
        (r) => {
          result = r;
          done();
        }, (e) => {
          failure = e;
          done();
        })
    });
  };

  function forFixtures(fixtureNames: string|string[], contextF: (f?: string[]) => void) {
    if (typeof fixtureNames == "string") fixtureNames = [<string>fixtureNames];

    context("for fixtures " + (<string[]>fixtureNames).join(", "), () => {
      before((done) => {
        runGenerator(<string[]>fixtureNames, done);
      });
      after(() => { fixtureNames = null });
      contextF(<string[]>fixtureNames);
    })
  }

  function generatorShouldFailWith(fixtureName: string|string[], msg: string) {
    forFixtures(fixtureName, () => {
      it("fails with expected message", () => {
        assert.equal(result, null, "result should have been empty.");
        assert.equal(failure.toString(), msg);
      })
    })
  }

  function generatorShouldProduceNoOutput(fixtureName: string|string[]) {
    forFixtures(fixtureName, () => {
      it("produces no error, but also no output", () => {
        assert.equal(failure, null);
        assert.equal(Object.keys(result.output).length, 0);
      })
    })
  }

  function forValidRunResult(fixtureName: string|string[], contextF: (f?: string[]) => void = () => { }) {
    forFixtures(fixtureName, (fixtureNames: string[]) => {
      it("does not fail generation", () => {
        assert.equal(failure, null);
      });

      describe("the RunResult output", () => {
        before(() => {
          var promises: Promise<any>[] = [];

          if (failure) throw failure;
          for (let fileName in result.output) {
            var expectedFileName = fileName.replace(runOutputDir, "test/expected/");

            if (!fs.existsSync(expectedFileName) || reloadExpected) {
              var outText = result.output[fileName].source.toString();
              promises.push(utils.writeFile(expectedFileName, outText));
            }
          }

          return Promise.all(promises);
        });

        it("matches expected", () => {
          for (let fileName in result.output) {
            var expectedFileName = fileName.replace(runOutputDir, "test/expected/");
            assert.equal(result.output[fileName].source.toString(), fs.readFileSync(expectedFileName).toString());
          }
        });

        contextF(fixtureNames);
      })
    })
  };

  function forValidGeneratedModules(fixtureName: string|string[], contextF: (f?: string[]) => void = () => { }) {
    forValidRunResult(fixtureName, (fixtureNames: string[]) => {
      describe("the output modules", () => {
        before(() => {
          var fileNames: string[] = Object.keys(result.output);
          return result.writeChanges().then(() => {
            var compiler = ts.createProgram(projectFiles.concat(fileNames), compilerOptions);
            var emitResult = compiler.emit();
            var allDiagnostics = ts.getPreEmitDiagnostics(compiler).concat(emitResult.diagnostics);

            for (var diagnostic of allDiagnostics) {
              if (diagnostic.category != ts.DiagnosticCategory.Message) {
                var { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                throw new Error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
              }
            }

            for (let fileName of fileNames) {
              ModuleClasses[fileName.replace(runOutputDir, "")] = require(fileName.replace("test/", "./").replace(".ts", "")).Module;
            }
          });
        })

        contextF(fixtureNames);
      });
    });
  }

  forValidGeneratedModules(["interrelated-modules/index.ts", "interrelated-modules/sub.ts"], () => {
    it("invokes constructs all related modules, only once per class", () => {
      var graph = pitcher.build(new ModuleClasses["interrelated-modules/index.ts"]);
      assert.deepEqual(graph.constructorCountProvider.get()[0], [1, 1, 1, 1, 1]);
    })
  })

  forValidGeneratedModules("all-provider-types.ts", () => {
    it("provides all expected results", (done) => {
      var graph = pitcher.build(new ModuleClasses["all-provider-types.ts"]);
      graph.finalSolutionProvider.get((finalSolution: any, err: any) => {
        if (err) {
          done(err);
          return;
        }

        try {
          assert.equal(finalSolution.secretNumber, 25683);
          assert.deepEqual(finalSolution.wrappedSecretNumber, { wrapped: 25683 });
          assert.deepEqual(finalSolution.specialtyPizza, { toppings: ["cheese"] });
          assert.equal(finalSolution.randomNumberFactory(), 25684);
          assert.equal(finalSolution.randomNumberFactory(), 25685);
          assert.equal(finalSolution.randomNumberFactory(), 25686);
          assert.deepEqual(finalSolution.pizzaFactory(), { toppings: ["cheese"] });
          assert.notEqual(finalSolution.pizzaFactory(), finalSolution.pizzaFactory());
          assert.deepEqual(finalSolution.futurePizza, { toppings: ["pepperoni", "mushroom25683"] });
          assert.deepEqual(finalSolution.doubleDipping, [4, 5, 6]);
          assert.deepEqual(finalSolution.toppings, ["cheese"]);
          assert.deepEqual(finalSolution.superToppings, ["bell pepper", "onion"]);
          assert.deepEqual(finalSolution.bestBestToppings, ["sausage"]);
          assert.deepEqual(finalSolution.twiceOver, [1, 2, 3]);
        } catch (e) {
          done(e);
          return;
        }

        done();
      })
    })
  })

  forValidGeneratedModules([
    "rewrite-replace-existing.ts",
    "rewrite-install-body.ts",
    "rewrite-install-signature.ts",
    "given-as-constructor-property.ts"
  ], (fixtureNames: string[]) => {
    fixtureNames.forEach((fixtureName) => {
      it("provides expected results from " + fixtureName, () => {
        var graph = pitcher.build(new ModuleClasses[fixtureName]);
        var key = graph.theSecretKeyProvider.get()[0];
        assert.equal(key, 15);
      });
    });
  });

  forValidGeneratedModules("property-is-totes-ok.ts", () => {
    it("provides expected results", () => {
      var graph = pitcher.build(new ModuleClasses["property-is-totes-ok.ts"]);
      var magic = graph.magicProvider.get()[0]
      assert.equal(magic, "ho!");
    });
  });

  forValidGeneratedModules("dependency-across-includes.ts", () => {
    it("provides expected result", () => {
      var graph = pitcher.build(new ModuleClasses["dependency-across-includes.ts"]);
      var farm = graph.farmProvider.get()[0]
      assert.equal(farm, "Bob living in a house costing $1500 with chickens being sold to the market");
    })
  })

  forValidGeneratedModules(["merge-factory-first.ts", "merge-given-first.ts"], (fixtureNames) => {
    fixtureNames.forEach((fixtureName) => {
      it("provides the expected result when the given value is undefined", () => {
        var graph = pitcher.build(new ModuleClasses[fixtureName]);
        var value = graph.valueProvider.get()[0];
        assert.equal(value, "default");
      })

      it("provides the expected result when the given value is null", () => {
        var graph = pitcher.build(new ModuleClasses[fixtureName](null));
        var value = graph.valueProvider.get()[0];
        assert.equal(value, null);
      })

      it("provides the expected result when the given value is given", () => {
        var graph = pitcher.build(new ModuleClasses[fixtureName]("given"));
        var value = graph.valueProvider.get()[0];
        assert.equal(value, "given");
      })
    });
  });

  generatorShouldFailWith("collection-circular-dependency.ts",
    "Error: test/fixtures/collection-circular-dependency.ts(25,2): Circular dependency cannot be resolved: a -> b -> c -> e")
  generatorShouldFailWith("missing-collection-dependency.ts",
    "Error: test/fixtures/missing-collection-dependency.ts(5,2): contributesDoDad requires dependency named blah, but no provider was found")
  generatorShouldFailWith("missing-dependency.ts",
    "Error: test/fixtures/missing-dependency.ts(5,2): providesDoDad requires dependency named blah, but no provider was found")
  generatorShouldFailWith("circular-includes.ts",
    "Error: test/fixtures/circular-includes.ts(15,15): circular module includes found.  Module SubModuleB is included by but transiently includes SubModuleA")
  generatorShouldFailWith("no-value-provider.ts",
    "Error: test/fixtures/no-value-provider.ts(3,2): Provider value is not of valid construction.");
  generatorShouldFailWith("private-provider.ts",
    "Error: test/fixtures/private-provider.ts(3,2): providedValue is named like a provider, but providers may only be public");
  generatorShouldFailWith("no-export-modifier-module.ts",
    "Error: test/fixtures/no-export-modifier-module.ts(2,0): any pitcher.Module must be a declared export");
  generatorShouldFailWith("single-export-module.ts",
    "Error: test/fixtures/single-export-module.ts(2,0): any pitcher.Module must be a declared export");
  generatorShouldFailWith("graph-cannot-be-subclass.ts",
    "Error: test/fixtures/graph-cannot-be-subclass.ts(4,0): pitcher.Modules cannot contain a superclass.");
  generatorShouldFailWith("includes-not-pitcher-module.ts",
    "Error: test/fixtures/includes-not-pitcher-module.ts(6,14): class literal NotAModule is referenced as an include, but is not a pitcher.Module.");
  generatorShouldFailWith("provider-name-conflict.ts",
    "Error: test/fixtures/provider-name-conflict.ts(7,2): Provider contributesPie conflicts with existing local providesPie definition.");
  generatorShouldFailWith("provider-name-conflicts-across-modules.ts",
    "Error: test/fixtures/provider-name-conflicts-across-modules.ts(5,2): Provider pie conflicts with definition given in included module OtherModule");
  generatorShouldFailWith("multi-signatures.ts",
    "Error: test/fixtures/multi-signatures.ts(6,2): Provider magicCape cannot be inferred from given callable, as it has multiple signature options.  Create an explicit provider.");

  forValidRunResult("interrelated-modules/index.ts", () => {
    it("should fail to write the result", () => {
      return result.writeChanges().then(() => {
        throw new Error("Expected writeChanges() to fail!");
      }).catch((e) => {
        assert.equal(e.toString(), "Error: test/fixtures/interrelated-modules/sub.ts(0,0): Included module requires editing, but was not part of moduleSources.");
      });
    })
  })

  forValidRunResult("interrelated-modules-built/index.ts", () => {
    it("should not fail to write the result, and have no need to write sub.ts", () => {
      assert.notEqual(result.output["test/built/interrelated-modules-built/index.ts"], undefined);
      assert.equal(result.output["test/built/interrelated-modules-built/sub.ts"], undefined);
      return result.writeChanges();
    })
  })

  generatorShouldProduceNoOutput("ignores-ambient-classes.ts")
  generatorShouldProduceNoOutput("rewrite-noop.ts");

  context("Regenerating self", () => {
    before((done) => {
      runGenerator([], done, "lib/*.ts");
    });

    it("produces no error, but also no output", () => {
      assert.equal(failure, null);
      assert.equal(Object.keys(result.output).length, 0);
    })
  })
});
