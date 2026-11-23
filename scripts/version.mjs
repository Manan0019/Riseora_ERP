import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export const packages = ["client", "server", "desktop"];

// SemVer 2.0.0: numeric identifiers cannot have leading zeroes.
const numeric = "(?:0|[1-9][0-9]*)";
const prerelease = `(?:${numeric}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)`;
const semanticVersion = new RegExp(
  `^${numeric}\\.${numeric}\\.${numeric}(?:-${prerelease}(?:\\.${prerelease})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
);

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8").replace(/^\uFEFF/, ""));
}

export function readVersion(root = projectRoot) {
  const { version } = readJson(path.join(root, "version.json"));
  if (typeof version !== "string" || !semanticVersion.test(version)) {
    throw new Error("version.json must contain a valid semantic version (for example, 1.2.3).");
  }
  return version;
}

export function installerName(version) {
  return `Riseora-ERP-Setup-${version}.exe`;
}

export function syncVersion({ root = projectRoot, check = false } = {}) {
  const version = readVersion(root);
  const pending = [];
  // Read and validate every input before writing anything.
  for (const directory of packages) {
    for (const name of ["package.json", "package-lock.json"]) {
      const filename = path.join(root, directory, name);
      const original = fs.readFileSync(filename, "utf8");
      const metadata = readJson(filename);
      let stale = metadata.version !== version;
      metadata.version = version;
      if (name === "package-lock.json" && metadata.lockfileVersion >= 2) {
        if (!metadata.packages?.[""]) {
          throw new Error(`${filename}: missing npm lockfile root package metadata.`);
        }
        stale ||= metadata.packages[""].version !== version;
        metadata.packages[""].version = version;
      }
      if (stale) {
        const newline = original.includes("\r\n") ? "\r\n" : "\n";
        const indent = original.match(/\n([ \t]+)"/)?.[1] || "  ";
        pending.push({ filename, content: (JSON.stringify(metadata, null, indent) + "\n").replace(/\n/g, newline) });
      }
    }
  }
  const desktop = readJson(path.join(root, "desktop/package.json"));
  if (desktop.build?.win?.artifactName !== "Riseora-ERP-Setup-${version}.${ext}") {
    throw new Error("Electron Builder artifactName must derive from ${version} and ${ext}.");
  }
  if (desktop.build?.extraMetadata?.version !== undefined || desktop.build?.buildVersion !== undefined) {
    throw new Error("Electron Builder must use the synchronized package version without a version override.");
  }
  if (check && pending.length) {
    throw new Error(`Version metadata differs from ${version}. Run node scripts/version.mjs:\n${pending.map(({ filename }) => path.relative(root, filename)).join("\n")}`);
  }
  for (const { filename, content } of pending) fs.writeFileSync(filename, content);
  return version;
}

export function verifyInstaller(filename, root = projectRoot) {
  const version = syncVersion({ root, check: true });
  if (path.basename(filename) !== installerName(version)) {
    throw new Error(`Expected installer filename: ${installerName(version)}`);
  }
  if (!fs.statSync(filename).isFile() || fs.statSync(filename).size < 10 * 1024 * 1024) {
    throw new Error(`Installer is missing or unexpectedly small: ${filename}`);
  }
  return version;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, filename, ...extra] = process.argv.slice(2);
    if (extra.length || (filename && mode !== "--verify-installer")) throw new Error("Unexpected version command arguments.");
    if (mode === "--print") console.log(readVersion());
    else if (mode === "--verify-installer") {
      const installer = filename ? path.resolve(filename) : path.join(projectRoot, "desktop/release", installerName(readVersion()));
      console.log(`Verified installer for ${verifyInstaller(installer)}: ${installer}`);
    } else if (mode === undefined || mode === "--check") {
      console.log(`Version ${syncVersion({ check: mode === "--check" })}: ${mode === "--check" ? "consistent" : "synchronized"}.`);
    } else throw new Error("Usage: node scripts/version.mjs [--check | --print | --verify-installer <file>]");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
