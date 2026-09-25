import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const desktopDir = path.resolve(__dirname, "..");
const projectRoot = path.resolve(desktopDir, "..");
const clientDir = path.join(projectRoot, "client");
const serverDir = path.join(projectRoot, "server");

const generatedAppDir = path.join(desktopDir, "app");
const generatedServerDir = path.join(generatedAppDir, "server");
const generatedClientDir = path.join(generatedAppDir, "client");
const buildDir = path.join(desktopDir, "build");

function fail(message) {
  console.error(`\nPREPARE FAILED: ${message}\n`);
  process.exit(1);
}

function requirePath(target, label) {
  if (!fs.existsSync(target)) {
    fail(`${label} was not found: ${target}`);
  }
}

requirePath(clientDir, "Client folder");
requirePath(serverDir, "Server folder");
requirePath(path.join(serverDir, "src"), "Server source");
requirePath(path.join(clientDir, "package.json"), "Client package.json");

console.log("\n[1/5] Building React production frontend...");

const build =
  process.platform === "win32"
    ? spawnSync(
        process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
        ["/d", "/s", "/c", "npm run build"],
        {
          cwd: clientDir,
          stdio: "inherit",
          windowsHide: true,
        },
      )
    : spawnSync(
        "npm",
        ["run", "build"],
        {
          cwd: clientDir,
          stdio: "inherit",
        },
      );

if (build.error) {
  fail(
    `Unable to start the React production build process: ${build.error.message}`,
  );
}

if (build.status !== 0) {
  fail(
    `React production build failed with exit code ${build.status}. Fix the client build before creating the installer.`,
  );
}

const clientDist = path.join(clientDir, "dist");
requirePath(clientDist, "Built client/dist");

console.log("[2/5] Rebuilding generated desktop app payload...");
fs.rmSync(generatedAppDir, {
  recursive: true,
  force: true,
});
fs.mkdirSync(generatedServerDir, { recursive: true });
fs.mkdirSync(generatedClientDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

fs.cpSync(
  path.join(serverDir, "src"),
  path.join(generatedServerDir, "src"),
  {
    recursive: true,
    force: true,
  },
);

fs.cpSync(
  clientDist,
  path.join(generatedClientDir, "dist"),
  {
    recursive: true,
    force: true,
  },
);

console.log("[3/5] Locking packaged backend to localhost only...");
const packagedAppJs = path.join(
  generatedServerDir,
  "src",
  "app.js",
);

let appSource = fs.readFileSync(packagedAppJs, "utf8");

const listenPattern =
  /app\.listen\(\s*PORT\s*,\s*\(\)\s*=>/m;

if (!listenPattern.test(appSource)) {
  fail(
    "Could not identify the final app.listen(PORT, () => ...) call in server/src/app.js. The desktop payload was not modified.",
  );
}

appSource = appSource.replace(
  listenPattern,
  'app.listen(PORT, "127.0.0.1", () =>',
);

fs.writeFileSync(packagedAppJs, appSource, "utf8");

console.log("[4/5] Preparing Windows icon...");
const iconCandidates = [
  path.join(clientDir, "src", "assets", "riseora-Logo-Vertical.png"),
  path.join(clientDir, "src", "assets", "riseora-logo-Horizontal.png"),
  path.join(clientDir, "src", "assets", "riseora-logo-vertical.png"),
];

const iconSource =
  iconCandidates.find((candidate) => fs.existsSync(candidate));

if (!iconSource) {
  fail(
    "Riseora PNG logo was not found in client/src/assets. Add riseora-Logo-Vertical.png or riseora-logo-Horizontal.png.",
  );
}

fs.copyFileSync(
  iconSource,
  path.join(buildDir, "icon.png"),
);

console.log("[5/5] Safety checks...");

const forbiddenFiles = [
  path.join(generatedAppDir, "server", ".env"),
  path.join(generatedAppDir, "data", "riseora_erp.db"),
];

for (const forbidden of forbiddenFiles) {
  if (fs.existsSync(forbidden)) {
    fail(
      `Sensitive/runtime file was unexpectedly copied into the installer payload: ${forbidden}`,
    );
  }
}

const copiedDbFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (
      /\.(db|sqlite|sqlite3)$/i.test(entry.name) ||
      entry.name === ".env"
    ) {
      copiedDbFiles.push(fullPath);
    }
  }
}

walk(generatedAppDir);

if (copiedDbFiles.length > 0) {
  fail(
    [
      "Installer payload contains a database or .env file.",
      ...copiedDbFiles,
      "Remove runtime data/secrets before building.",
    ].join("\n"),
  );
}

console.log("\nDesktop payload ready.");
console.log(`Server copied from: ${path.join(serverDir, "src")}`);
console.log(`Client copied from: ${clientDist}`);
console.log("Database copied: NO");
console.log("server/.env copied: NO");
console.log("Backend bind: 127.0.0.1 only");
console.log("\nYou can now run: npm run build:win\n");
