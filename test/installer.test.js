var expect = require("expect");
var fs = require("fs");
var path = require("path");
var spawn = require("cross-spawn");

var installer = require("../src/installer");

describe("installer", function() {
  describe(".check", function() {
    context("given nothing", function() {
      it("should return undefined", function() {
        expect(installer.check()).toBe(undefined);
      });
    });

    context("given a local module", function() {
      it("should return undefined", function() {
        expect(installer.check("./foo")).toBe(undefined);
      });
    });

    context("when process.cwd() is missing package.json", function() {
      before(function() {
        this.cwd = process.cwd();

        process.chdir(__dirname);
      });

      after(function() {
        process.chdir(this.cwd);
      });

      it("should throw", function() {
        expect(function() {
          installer.check("anything");
        }).toThrow(/Cannot find module/);
      });
    });

    context("given a dependency in package.json", function() {
      it("should return undefined", function() {
        expect(installer.check("cross-spawn")).toBe(undefined);
      });
    });

    context("given a devDependency in package.json", function() {
      it("should return undefined", function() {
        expect(installer.check("expect")).toBe(undefined);
      });
    });

    context("given a linked dependency", function() {
      beforeEach(function() {
        this.lstatSync = expect.spyOn(fs, "lstatSync").andReturn({
          isSymbolicLink: function() {
            return true;
          },
        });
      });

      afterEach(function() {
        this.lstatSync.restore();
      });

      it("should return undefined", function() {
        expect(installer.check("something-linked")).toBe(undefined);
        expect(this.lstatSync.calls.length).toBe(1);
        expect(this.lstatSync.calls[0].arguments).toEqual([
          [process.cwd(), "node_modules", "something-linked"].join("/"),
        ]);
      });
    });

    context("given a global module", function() {
      it("should return undefined", function () {
        expect(installer.check("path")).toBe(undefined);
      });
    });

    context("given a module", function() {
      it("should return module", function() {
        expect(installer.check("react")).toBe("react");
      });
    });

    context("given a module/and/path", function() {
      it("should return module", function() {
        expect(installer.check("react/proptypes")).toBe("react");
      });
    });

    context("given a @namespaced/module", function() {
      it("should return @namespaced/module", function() {
        expect(installer.check("@namespaced/module")).toBe("@namespaced/module");
      });
    });

    context("given a module already installed, but not saved", function() {
      it("should return module", function() {
        expect(installer.check("yargs")).toBe("yargs");
      });
    });

    context("given a webpack !!loader/module", function() {
      it("should return undefined", function() {
        expect(installer.check("!!./css-loader/index.js',")).toBe(undefined);
      });
    })
  });

  describe(".checkBabel", function() {
    beforeEach(function() {
      this.sync = expect.spyOn(spawn, "sync").andReturn({ stdout: null });

      expect.spyOn(console, "info");
    });

    afterEach(function() {
      expect.restoreSpies();
    });

    context("when .babelrc doesn't exist", function() {
      beforeEach(function() {
        process.chdir(path.join(process.cwd(), "test"));
      });

      afterEach(function() {
        process.chdir(path.join(process.cwd(), ".."));
      });

      it("should return early", function() {
        var result = installer.checkBabel();

        expect(result).toBe(undefined);
        expect(this.sync).toNotHaveBeenCalled();
      });
    });

    context("when .babelrc exists", function() {
      beforeEach(function() {
        process.chdir(path.join(process.cwd(), "example/webpack1"));

        this.check = expect.spyOn(installer, "check").andCall(function(dep) {
          return dep;
        });

        this.install = expect.spyOn(installer, "install");
      });

      afterEach(function() {
        process.chdir(path.join(process.cwd(), "../../"));
      });

      it("should check plugins & presets", function() {
        installer.checkBabel();

        var checked = this.check.calls.map(function(call) {
          return call.arguments[0];
        });

        expect(this.check).toHaveBeenCalled();
        expect(this.check.calls.length).toEqual(6);
        expect(checked).toEqual([
          'babel-core',
          'babel-plugin-react-html-attrs',
          'babel-preset-react',
          'babel-preset-es2015',
          'babel-preset-stage-0',
          'babel-preset-react-hmre'
        ]);
      });

      it("should install missing plugins & presets", function() {
        installer.checkBabel();

        expect(this.install).toHaveBeenCalled();
        expect(this.install.calls.length).toEqual(1);
        expect(this.install.calls[0].arguments).toEqual([
          [
            'babel-core',
            'babel-plugin-react-html-attrs',
            'babel-preset-react',
            'babel-preset-es2015',
            'babel-preset-stage-0',
            'babel-preset-react-hmre'
          ],
        ]);
      });
    });
  });

  describe(".checkPackage", function() {
    beforeEach(function() {
      this.sync = expect.spyOn(spawn, "sync").andReturn({ stdout: null });

      expect.spyOn(console, "info");
    });

    afterEach(function() {
      expect.restoreSpies();
    });

    context("when package.json exists", function() {
      it("should return early", function() {
        var result = installer.checkPackage();

        expect(result).toBe(undefined);
        expect(this.sync).toNotHaveBeenCalled();
      });
    });

    context("when package.json does not exist", function() {
      beforeEach(function() {
        process.chdir(path.join(process.cwd(), "test"));
      });

      afterEach(function() {
        process.chdir(path.join(process.cwd(), ".."));
      });

      it("should initialize NPM", function() {
        installer.checkPackage();

        expect(this.sync).toHaveBeenCalled();
        expect(this.sync.calls.length).toEqual(1);
        expect(this.sync.calls[0].arguments).toEqual([
          "npm",
          ["init -y"],
          { stdio: "inherit" },
        ]);
      });
    });
  });

  describe(".install", function() {
    beforeEach(function() {
      this.sync = expect.spyOn(spawn, "sync").andReturn({ stdout: null });

      expect.spyOn(console, "info");
    });

    afterEach(function() {
      expect.restoreSpies();
    });

    context("given a falsey value", function() {
      it("should return undefined", function() {
        expect(installer.install()).toEqual(undefined);
        expect(installer.install(0)).toEqual(undefined);
        expect(installer.install(false)).toEqual(undefined);
        expect(installer.install(null)).toEqual(undefined);
        expect(installer.install("")).toEqual(undefined);
      });
    });

    context("given an empty array", function() {
      it("should return undefined", function () {
        expect(installer.install([])).toEqual(undefined);
      });
    });

    context("given a dependency", function() {
      it("should install it", function() {
        var result = installer.install("foo");

        expect(this.sync).toHaveBeenCalled();
        expect(this.sync.calls.length).toEqual(1);
        expect(this.sync.calls[0].arguments[0]).toEqual("npm");
        expect(this.sync.calls[0].arguments[1]).toEqual(["install", "foo"]);
      });

      context("given options", function() {
        it("should pass them to child process", function() {
          var result = installer.install("foo", {
            save: true,
            saveExact: false,
            registry: "https://registry.npmjs.com/",
          });

          expect(this.sync).toHaveBeenCalled();
          expect(this.sync.calls.length).toEqual(1);
          expect(this.sync.calls[0].arguments[0]).toEqual("npm");
          expect(this.sync.calls[0].arguments[1]).toEqual([
            "install",
            "foo",
            "--save",
            "--registry='https://registry.npmjs.com/'",
          ]);
        });
      });

      context("with missing peerDependencies", function() {
        beforeEach(function() {
          this.sync.andCall(function(bin, args) {
            var dep = args[1];

            if (dep === "redbox-react") {
              return {
                stdout: new Buffer([
                  "/test",
                  "├── redbox-react@1.2.3",
                  "└── UNMET PEER DEPENDENCY react@>=0.13.2 || ^0.14.0-rc1 || ^15.0.0-rc",
                ].join("\n")),
              };
            }

            return { stdout: null };
          });
        });

        it("should install peerDependencies", function() {
          var result = installer.install("redbox-react");

          expect(this.sync.calls.length).toEqual(2);
          expect(this.sync.calls[0].arguments[1]).toEqual(["install", "redbox-react"]);
          expect(this.sync.calls[1].arguments[1]).toEqual(["install", "react@\">=0.13.2 || ^0.14.0-rc1 || ^15.0.0-rc\""]);
        });
      })
    });
  });
});
