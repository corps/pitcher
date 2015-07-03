import ts = require("typescript");
import Promise = require("bluebird");
import run = require("../modules/run");
import analyzer = require("../modules/analyzer");
import pitcher = require("../lib/runtime");
import program = require("commander");
import path = require("path");
import fs = require("fs");

interface Options {
  project: string
  batch: number
  watch: boolean
}

function failHard(reason: any) {
  console.error(reason);
  process.exit(1);
}

program
  .version('0.0.1')
  .option('-p, --project <dir>', 'specify the directory from which to search for tsconfig.json file to load pitcher configuration.  defaults to the working directory')
  .option('-w, --watch', 'will continue to watch for file changes and rerun the process when detected')
  .option('-b, --batch <ms>', 'when watch is provided, after detecting a file change, the watch will wait the given ms before executing another run.  defaults to 500', parseInt)
  .parse(process.argv);

var programOpts: Options = program.opts();
programOpts.batch = programOpts.batch || 500;
programOpts.project = programOpts.project || process.cwd();

var configFilePath = ts.findConfigFile(programOpts.project);
if (configFilePath == null) {
  failHard("Could not find project in or parent of " + programOpts.project);
}

var configJSON = ts.readConfigFile(configFilePath);
var tsConfig = ts.parseConfigFile(configJSON, path.join(configFilePath, ".."));
var generatorConfig = <run.GeneratorConfig>(configJSON.pitcher || {});

function recoverOrExit(reason: any) {
  console.error(reason);
  if (!programOpts.watch)
    process.exit(1);
}

function formatTime(startTime: Date) {
  var now = new Date().getTime();
  var msPassed = now - startTime.getTime();
  return ((msPassed % 60000) / 1000).toFixed(2) + "s";
}

// TODO: Make this alot faster via deeper integration with language host.
function preformRun() {
  console.log("pitcher code generator running...");
  var startTime = new Date();
  return new Promise<string[]>((resolve: (r: string[]) => void, reject: any) => {
    var runGraph = pitcher.build<run.ModuleGraph>(
      new run.Module(generatorConfig),
      new analyzer.Module({ projectDir: programOpts.project }));

    runGraph.runProvider.get((run, err) => {
      if (err) {
        failHard(err);
      }

      return run().then((result) => {
        console.log("processing complete in", formatTime(startTime));
        console.log("found changes for files", Object.keys(result.output));
        startTime = new Date();
        return result.writeChanges().then(() => {
          console.log("file writes completed in", formatTime(startTime));
        })
      }).catch(recoverOrExit).then(() => {
        return runGraph.tsProgramProvider.get()[0].getSourceFiles().map(s => s.fileName);
      }).then(resolve, reject);
    });
  });
}

var finishRun = preformRun();
if (programOpts.watch) {
  function watchThenRerun() {
    finishRun = finishRun.then((watchFiles) => {
      console.log("beginning watch");
      return new Promise<string[]>((resolve: (paths: string[]) => void, reject: (e: any) => void) => {
        var fileWatchers = watchFiles.map((path) => {
          return fs.watch(path, () => {
            console.log("found change, waiting " + programOpts.batch + "ms");
            fileWatchers.forEach(w => w.close());
            setTimeout(() => {
              preformRun().then(resolve, reject);
            }, programOpts.batch)
          });
        })
      })
    }, <any>failHard)
    finishRun.then(() => watchThenRerun(), failHard);
  }
  watchThenRerun();
} else {
  finishRun.catch(failHard);
}
