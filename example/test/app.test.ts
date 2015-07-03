import assert = require("assert");
import { Module as AppModule, App } from "../modules/app";
import { Module as FakeTimeModule } from "../modules/fake-time";
import { Module as FakeConsoleModule } from "../modules/fake-console";
import pitcher = require("pitcher");
import fs = require("fs");

describe("App", () => {
  var fakeTime: FakeTimeModule;
  var fakeConsole: FakeConsoleModule;

  beforeEach(() => {
    fakeTime = new FakeTimeModule(new Date(2006, 10, 2));
    fakeConsole = new FakeConsoleModule();
    // Remove the target folder to clean up tests.
    if (fs.existsSync("test/target")) {
      var files = fs.readdirSync("test/target");
      files.forEach(function (file, index) {
        var curPath = "test/target/" + file;
        fs.unlinkSync(curPath);
      });
      fs.rmdirSync("test/target");
    }
  });

  function buildGraph() {
    return pitcher.forEntry(new AppModule("test/target")).build(fakeTime, fakeConsole);
  }

  it("fails when promised dependencies fail", (done) => {
    buildGraph().appProvider.get((app, err) => {
      try {
        assert.equal(app, null);
        assert.notEqual(err, null);
        assert.equal(err.toString(), "Error: ENOENT, readdir 'test/target'");
        assert.equal(fakeConsole.logs.length, 0);
        assert.deepEqual(fakeConsole.errorLogs, [["ERROR:Thu, 02 Nov 2006 08:00:00 GMT Error: ENOENT, readdir 'test/target'"]]);
        done();
      } catch (e) {
        done(e);
      }
    })
  })

  it("we can rerun the results with the rerun function", (done) => {
    fs.mkdirSync("test/target");
    fs.writeFileSync("test/target/a", "blah");
    fs.writeFileSync("test/target/b", "blah");
    buildGraph().appProvider.get((app, err) => {
      try {
        assert.equal(err, null);
        assert.notEqual(app, null);
        assert.deepEqual(fakeConsole.logs, [["DEBUG:Thu, 02 Nov 2006 08:00:00 GMT found directory files a,b"]]);
        assert.equal(app.oldestFile, "test/target/a");

        fakeTime.curTime = new Date(2006, 10, 3);
        setTimeout(() => {
          fs.writeFileSync("test/target/a", "new blah");
          fs.writeFileSync("test/target/c", "new blah");
          app.oldestFilePromise.then((oldestFile) => {
            assert.equal(oldestFile, "test/target/a");
            return app.rerun().then((oldestFile) => {
              assert.equal(oldestFile, "test/target/b");
              assert.deepEqual(fakeConsole.logs, [
                ["DEBUG:Thu, 02 Nov 2006 08:00:00 GMT found directory files a,b"],
                ["DEBUG:Fri, 03 Nov 2006 08:00:00 GMT found directory files a,b,c"],
              ]);
              done();
            })
          }).catch(done);
        }, 1500)
      } catch (e) {
        done(e);
      }
    })
  })
})
