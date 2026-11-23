import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import { installerName, packages, projectRoot, readVersion, syncVersion, verifyInstaller } from "./version.mjs";

const read = (root, name) => fs.readFileSync(path.join(root, name), "utf8");
const json = (root, name) => JSON.parse(read(root, name));
const write = (root, name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + "\n");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "riseora-version-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.copyFileSync(path.join(projectRoot, "version.json"), path.join(root, "version.json"));
  for (const directory of packages) {
    fs.mkdirSync(path.join(root, directory));
    for (const name of ["package.json", "package-lock.json"]) {
      fs.copyFileSync(path.join(projectRoot, directory, name), path.join(root, directory, name));
    }
  }
  return root;
}

test("central version and committed package/lock metadata agree", () => {
  assert.equal(syncVersion({ check: true }), readVersion());
});

test("accepts SemVer and rejects malformed versions before modifying metadata", (t) => {
  const root = fixture(t);
  for (const version of ["0.0.0", "1.1.4", "1.1.5", "2.0.0-rc.1+build.09"]) {
    write(root, "version.json", { version });
    assert.equal(readVersion(root), version);
  }
  const before = read(root, "client/package.json");
  for (const version of ["1.2", "v1.2.3", "01.2.3", "1.2.3-01", "1.2.3+", "1.2.3\n", " 1.2.3", 123, null]) {
    write(root, "version.json", { version });
    assert.throws(() => syncVersion({ root }), /valid semantic version/);
    assert.equal(read(root, "client/package.json"), before);
  }
});

test("changing only version.json updates all metadata and preserves all other fields", (t) => {
  const root = fixture(t);
  const originals = new Map();
  for (const directory of packages) {
    for (const name of ["package.json", "package-lock.json"]) {
      originals.set(`${directory}/${name}`, json(root, `${directory}/${name}`));
    }
  }
  for (const version of ["1.1.4", "1.1.5", "1.1.4"]) {
    write(root, "version.json", { version });
    syncVersion({ root });
    assert.equal(syncVersion({ root, check: true }), version);
    for (const [name, original] of originals) {
      const expected = structuredClone(original);
      expected.version = version;
      if (name.endsWith("package-lock.json")) expected.packages[""].version = version;
      assert.deepEqual(json(root, name), expected, name);
      const before = read(root, name);
      syncVersion({ root });
      assert.equal(read(root, name), before, "synchronization is idempotent");
    }
    const artifact = json(root, "desktop/package.json").build.win.artifactName
      .replace("${version}", version).replace("${ext}", "exe");
    assert.equal(artifact, installerName(version));
  }
});

test("check detects both lockfile version fields without repairing them", (t) => {
  const root = fixture(t);
  syncVersion({ root });
  for (const field of ["top", "root"]) {
    const lock = json(root, "server/package-lock.json");
    if (field === "top") lock.version = "0.0.0";
    else lock.packages[""].version = "0.0.0";
    write(root, "server/package-lock.json", lock);
    const before = read(root, "server/package-lock.json");
    assert.throws(() => syncVersion({ root, check: true }), /server[\\/]package-lock.json/);
    assert.equal(read(root, "server/package-lock.json"), before);
    syncVersion({ root });
  }
});

test("malformed lockfile and builder version overrides fail before any writes", (t) => {
  const root = fixture(t);
  write(root, "version.json", { version: "9.8.7" });
  const before = read(root, "client/package.json");
  const lock = json(root, "desktop/package-lock.json");
  delete lock.packages[""];
  write(root, "desktop/package-lock.json", lock);
  assert.throws(() => syncVersion({ root }), /missing npm lockfile root/);
  assert.equal(read(root, "client/package.json"), before);
  fs.copyFileSync(path.join(projectRoot, "desktop/package-lock.json"), path.join(root, "desktop/package-lock.json"));
  const desktop = json(root, "desktop/package.json");
  desktop.build.extraMetadata = { version: "0.0.0" };
  write(root, "desktop/package.json", desktop);
  assert.throws(() => syncVersion({ root }), /without a version override/);
  assert.equal(read(root, "client/package.json"), before);
});

test("frontend uses a Vite JSON import and renders the version expression", () => {
  const source = read(projectRoot, "client/src/layouts/MainLayout.jsx");
  assert.match(source, /import \{ version as appVersion \} from "\.\.\/\.\.\/\.\.\/version\.json"/);
  assert.match(source, /<small>Version \{appVersion\} · Local business system<\/small>/);
  assert.doesNotMatch(source, /Version \d+\.\d+\.\d+/);
});

test("health callback reads packaged metadata with no repository root present", (t) => {
  const root = fixture(t);
  const source = read(projectRoot, "server/src/app.js");
  const declaration = source.match(/^const appVersion = .+;$/m)?.[0];
  const route = source.match(/app\.get\("\/api\/health",[\s\S]*?\n\}\);/)?.[0];
  assert.ok(declaration && route, "health metadata and route must be present");
  const packaged = path.join(root, "isolated-payload/server");
  fs.mkdirSync(path.join(packaged, "src"), { recursive: true });
  assert.ok(!fs.existsSync(path.join(root, "isolated-payload/version.json")));
  for (const version of ["1.1.4", "1.1.5"]) {
    write(root, "version.json", { version });
    syncVersion({ root });
    fs.copyFileSync(path.join(root, "server/package.json"), path.join(packaged, "package.json"));
    let result;
    let status;
    // Execute the actual metadata declaration and health callback in isolation,
    // without importing database initialization or opening any business database.
    vm.runInNewContext(`${declaration.replace("import.meta.url", "moduleUrl")}\n${route}`, {
      fs, URL, moduleUrl: pathToFileURL(path.join(packaged, "src/app.js")).href,
      app: { get(url, handler) {
        assert.equal(url, "/api/health");
        const response = { status(code) { status = code; return response; }, json(body) { result = body; } };
        handler({}, response);
      } },
    });
    assert.equal(status, 200);
    assert.equal(result.success, true);
    assert.equal(result.version, version);
  }
  assert.match(read(projectRoot, "desktop/scripts/prepare-app.mjs"), /fs\.copyFileSync\(path\.join\(serverDir, "package.json"\), path\.join\(generatedServerDir, "package.json"\)\)/);
});

test("installer verification rejects wrong versions, missing files and tiny files", (t) => {
  const root = fixture(t);
  const version = syncVersion({ root });
  const installer = path.join(root, installerName(version));
  assert.throws(() => verifyInstaller(path.join(root, "wrong.exe"), root), /Expected installer filename/);
  assert.throws(() => verifyInstaller(installer, root), /ENOENT/);
  fs.writeFileSync(installer, "not an installer");
  assert.throws(() => verifyInstaller(installer, root), /unexpectedly small/);
  // Sparse fixture validates naming/size only; this is not an installer smoke test.
  fs.truncateSync(installer, 10 * 1024 * 1024);
  assert.equal(verifyInstaller(installer, root), version);
});

test("local workflows synchronize automatically and CI keeps business regression tests", () => {
  for (const name of ["predev", "prebuild"]) assert.equal(json(projectRoot, "client/package.json").scripts[name], "node ../scripts/version.mjs");
  for (const name of ["predev", "prestart"]) assert.equal(json(projectRoot, "server/package.json").scripts[name], "node ../scripts/version.mjs");
  const desktop = json(projectRoot, "desktop/package.json");
  for (const name of ["start", "build:dir", "build:win"]) assert.match(desktop.scripts[name], /npm run prepare:app/);
  assert.match(read(projectRoot, "desktop/scripts/prepare-app.mjs"), /const appVersion = syncVersion\(\)/);
  assert.match(desktop.scripts["postbuild:win"], /--verify-installer/);
  const build = read(projectRoot, "BUILD_RISEORA_INSTALLER.ps1");
  assert.doesNotMatch(build, /\b\d+\.\d+\.\d+\b/);
  assert.match(build, /Riseora-ERP-Setup-\$Version\.exe/);
  assert.match(build, /--verify-installer/);
  const workflow = read(projectRoot, ".github/workflows/riseora-windows.yml");
  assert.ok(workflow.indexOf("node scripts/version.mjs") < workflow.indexOf("run: npm ci"));
  assert.match(workflow, /npm run test:regression/);
  assert.match(workflow, /npm run test:v114/);
  assert.match(workflow, /Riseora-ERP-Setup-\$\{\{ steps\.version\.outputs\.version \}\}\.exe/);
});
