import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

import Database from "better-sqlite3";
import express from "express";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
} from "electron";

const APP_ID = "in.riseora.erp";
const BACKEND_PORT = 5000;
const FRONTEND_PORT = 5173;
const LOCAL_FRONTEND = `http://localhost:${FRONTEND_PORT}`;
const LOCAL_BACKEND = `http://127.0.0.1:${BACKEND_PORT}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.setName("Riseora ERP");
app.setAppUserModelId(APP_ID);

if (process.argv.includes("--dev-data")) {
  const devUserData = path.join(__dirname, ".dev-user-data");
  fs.mkdirSync(devUserData, { recursive: true });
  app.setPath("userData", devUserData);
}

let mainWindow = null;
let setupWindow = null;
let frontendServer = null;
let runtimeStarting = false;
let runtimeStarted = false;

function appPaths() {
  const userData = app.getPath("userData");
  const businessData = path.join(userData, "business-data");

  return {
    userData,
    businessData,
    dataDir: path.join(businessData, "data"),
    dbPath: path.join(businessData, "data", "riseora_erp.db"),
    backupDir: path.join(businessData, "backups"),
    configPath: path.join(businessData, "desktop-config.json"),
    logsDir: path.join(businessData, "logs"),
  };
}

function ensureRuntimeFolders() {
  const paths = appPaths();

  for (const dir of [
    paths.businessData,
    paths.dataDir,
    paths.backupDir,
    paths.logsDir,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return paths;
}

function loadDesktopConfig() {
  const { configPath, dbPath } = ensureRuntimeFolders();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.sessionSecret
    ) {
      return null;
    }

    /*
     * Before the first database exists we still need the password so
     * seedAdmin can create the owner account. Once the DB exists, the
     * password is deliberately removed from this config file.
     */
    if (
      !fs.existsSync(dbPath) &&
      !parsed.initialAdminPassword
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function safeText(value) {
  return String(value ?? "").trim();
}

function validateInitialPassword(password) {
  const value = String(password || "");

  if (value.length < 8) {
    return "Administrator password must be at least 8 characters.";
  }

  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Administrator password must contain at least one letter and one number.";
  }

  return null;
}

function saveDesktopConfig(payload) {
  const { configPath } = ensureRuntimeFolders();

  const adminPassword = String(payload.adminPassword || "");
  const passwordError = validateInitialPassword(adminPassword);

  if (passwordError) {
    throw new Error(passwordError);
  }

  if (adminPassword !== String(payload.confirmPassword || "")) {
    throw new Error("Administrator passwords do not match.");
  }

  const smtpUser = safeText(payload.smtpUser);
  const smtpPass = String(payload.smtpPass || "");
  const smtpFrom = safeText(payload.smtpFrom);

  if ((smtpUser && !smtpPass) || (!smtpUser && smtpPass)) {
    throw new Error("SMTP user and SMTP App Password must either both be entered or both be left blank.");
  }

  const smtpEnabled = Boolean(smtpUser && smtpPass);

  const config = {
    configVersion: 1,
    createdAt: new Date().toISOString(),
    sessionSecret: crypto.randomBytes(48).toString("base64url"),
    initialAdminUsername: "ram",
    initialAdminFullName: "Ram",
    initialAdminPassword: adminPassword,
    smtp: {
      enabled: smtpEnabled,
      host: smtpEnabled ? safeText(payload.smtpHost) || "smtp.gmail.com" : "",
      port: smtpEnabled ? Number(payload.smtpPort || 587) : 587,
      secure: smtpEnabled ? Boolean(payload.smtpSecure) : false,
      user: smtpEnabled ? smtpUser : "",
      pass: smtpEnabled ? smtpPass : "",
      from: smtpEnabled ? (smtpFrom || `Riseora Herbals <${smtpUser}>`) : "",
    },
    otp: {
      minutes: 10,
      resendSeconds: 60,
      maxAttempts: 5,
    },
  };

  if (
    config.smtp.enabled &&
    (!Number.isInteger(config.smtp.port) ||
      config.smtp.port <= 0 ||
      config.smtp.port > 65535)
  ) {
    throw new Error("SMTP port is invalid.");
  }

  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2),
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );

  return config;
}

function applyDesktopConfig(config) {
  const paths = ensureRuntimeFolders();

  process.env.NODE_ENV = "desktop";
  process.env.PORT = String(BACKEND_PORT);
  process.env.CLIENT_ORIGIN = LOCAL_FRONTEND;
  process.env.RISEORA_DB_PATH = paths.dbPath;
  process.env.RISEORA_BACKUP_DIR = paths.backupDir;

  process.env.SESSION_SECRET = String(config.sessionSecret);
  process.env.INITIAL_ADMIN_USERNAME =
    safeText(config.initialAdminUsername) || "ram";
  process.env.INITIAL_ADMIN_FULL_NAME =
    safeText(config.initialAdminFullName) || "Ram";
  process.env.INITIAL_ADMIN_PASSWORD =
    String(
      config.initialAdminPassword ||
      crypto.randomBytes(32).toString("base64url"),
    );

  const smtp = config.smtp || {};
  process.env.SMTP_HOST = smtp.enabled ? safeText(smtp.host) : "";
  process.env.SMTP_PORT = smtp.enabled ? String(smtp.port || 587) : "587";
  process.env.SMTP_SECURE = smtp.enabled && smtp.secure ? "true" : "false";
  process.env.SMTP_USER = smtp.enabled ? safeText(smtp.user) : "";
  process.env.SMTP_PASS = smtp.enabled ? String(smtp.pass || "") : "";
  process.env.SMTP_FROM = smtp.enabled ? safeText(smtp.from) : "";

  const otp = config.otp || {};
  process.env.PASSWORD_RESET_OTP_MINUTES =
    String(otp.minutes || 10);
  process.env.PASSWORD_RESET_RESEND_SECONDS =
    String(otp.resendSeconds || 60);
  process.env.PASSWORD_RESET_MAX_ATTEMPTS =
    String(otp.maxAttempts || 5);
}

function scrubInitialAdminPassword() {
  const { configPath, dbPath } = ensureRuntimeFolders();

  if (!fs.existsSync(configPath) || !fs.existsSync(dbPath)) {
    return;
  }

  try {
    const config = JSON.parse(
      fs.readFileSync(configPath, "utf8"),
    );

    if (!config.initialAdminPassword) {
      return;
    }

    delete config.initialAdminPassword;
    config.initializedAt =
      config.initializedAt || new Date().toISOString();

    fs.writeFileSync(
      configPath,
      JSON.stringify(config, null, 2),
      {
        encoding: "utf8",
        mode: 0o600,
      },
    );
  } catch (error) {
    console.warn(
      "Unable to remove the one-time initial admin password from desktop config:",
      error?.message || error,
    );
  }
}

function timestampForFile() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
}

async function createStartupBackupIfNeeded() {
  const paths = ensureRuntimeFolders();

  if (!fs.existsSync(paths.dbPath)) {
    return;
  }

  let db;

  try {
    db = new Database(paths.dbPath, {
      fileMustExist: true,
      timeout: 5000,
    });

    const integrity = String(
      db.pragma("quick_check", { simple: true }),
    ).toLowerCase();

    if (integrity !== "ok") {
      throw new Error(
        `SQLite quick_check returned "${integrity}".`,
      );
    }

    const destination = path.join(
      paths.backupDir,
      `startup_${timestampForFile()}.db`,
    );

    await db.backup(destination);
  } finally {
    try {
      db?.close();
    } catch {
      // Ignore close-only errors.
    }
  }

  const files = fs
    .readdirSync(paths.backupDir)
    .filter((name) => /^startup_.*\.db$/i.test(name))
    .map((name) => {
      const fullPath = path.join(paths.backupDir, name);
      return {
        name,
        fullPath,
        modifiedMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.modifiedMs - a.modifiedMs);

  for (const oldBackup of files.slice(30)) {
    fs.rmSync(oldBackup.fullPath, { force: true });
  }
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, "127.0.0.1");
  });
}

function startFrontendServer() {
  const appRoot = app.getAppPath();
  const clientDist = path.join(
    appRoot,
    "app",
    "client",
    "dist",
  );
  const indexPath = path.join(clientDist, "index.html");

  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Built frontend was not found at ${indexPath}. Rebuild the installer package.`,
    );
  }

  const frontend = express();

  /*
   * Support both possible client API styles:
   * - absolute http://localhost:5000/api
   * - relative /api
   *
   * Requests made to /api on port 5173 are streamed to the local backend.
   */
  frontend.use("/api", (req, res) => {
    const headers = { ...req.headers };
    headers.host = `127.0.0.1:${BACKEND_PORT}`;

    const proxyRequest = http.request(
      {
        hostname: "127.0.0.1",
        port: BACKEND_PORT,
        method: req.method,
        path: req.originalUrl,
        headers,
      },
      (proxyResponse) => {
        res.status(proxyResponse.statusCode || 500);

        for (const [name, value] of Object.entries(proxyResponse.headers)) {
          if (value !== undefined) {
            res.setHeader(name, value);
          }
        }

        proxyResponse.pipe(res);
      },
    );

    proxyRequest.on("error", (error) => {
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: `Riseora local API is unavailable: ${error.message}`,
        });
      } else {
        res.end();
      }
    });

    req.pipe(proxyRequest);
  });

  frontend.use(
    express.static(clientDist, {
      index: "index.html",
      fallthrough: true,
    }),
  );

  frontend.get(/.*/, (_req, res) => {
    res.sendFile(indexPath);
  });

  return new Promise((resolve, reject) => {
    frontendServer = frontend.listen(
      FRONTEND_PORT,
      "127.0.0.1",
      () => resolve(frontendServer),
    );

    frontendServer.once("error", reject);
  });
}

async function waitForBackend(timeoutMs = 30000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${LOCAL_BACKEND}/api/health`, {
        signal: AbortSignal.timeout(1500),
      });

      if (response.ok) {
        return;
      }
    } catch {
      // Backend is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    "Riseora local backend did not become ready within 30 seconds.",
  );
}

function configureWindowOpenPolicy(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith(`http://localhost:${FRONTEND_PORT}/`) ||
      url.startsWith(`http://127.0.0.1:${FRONTEND_PORT}/`)
    ) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1180,
          height: 820,
          minWidth: 900,
          minHeight: 650,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }

    if (/^https?:|^mailto:/i.test(url)) {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });
}

function createMainWindow() {
  const iconPath = path.join(
    app.getAppPath(),
    "build",
    "icon.png",
  );

  mainWindow = new BrowserWindow({
    title: "Riseora ERP",
    width: 1450,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#F6F0E8",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  configureWindowOpenPolicy(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();

    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.close();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(LOCAL_FRONTEND);
}

function createMenu() {
  const paths = ensureRuntimeFolders();

  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Riseora Data Folder",
          click: () => shell.openPath(paths.businessData),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Riseora ERP",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: "Riseora ERP",
              message: `Riseora ERP ${app.getVersion()}`,
              detail:
                "Local desktop ERP for Riseora Herbals.\n\nBusiness data and automatic backups are stored outside the installation folder.",
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(template),
  );
}

function createSetupWindow() {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus();
    return;
  }

  setupWindow = new BrowserWindow({
    title: "Set up Riseora ERP",
    width: 720,
    height: 760,
    minWidth: 640,
    minHeight: 680,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: "#F6F0E8",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  setupWindow.on("closed", () => {
    setupWindow = null;

    if (!runtimeStarted && !runtimeStarting) {
      app.quit();
    }
  });

  setupWindow.loadFile(
    path.join(__dirname, "setup.html"),
  );
}

async function startRuntime() {
  if (runtimeStarting || runtimeStarted) {
    return;
  }

  runtimeStarting = true;

  try {
    const config = loadDesktopConfig();

    if (!config) {
      runtimeStarting = false;
      createSetupWindow();
      return;
    }

    applyDesktopConfig(config);

    const backendAvailable = await isPortAvailable(BACKEND_PORT);
    const frontendAvailable = await isPortAvailable(FRONTEND_PORT);

    if (!backendAvailable || !frontendAvailable) {
      const busy = [
        !backendAvailable ? BACKEND_PORT : null,
        !frontendAvailable ? FRONTEND_PORT : null,
      ]
        .filter(Boolean)
        .join(", ");

      throw new Error(
        `Required local port(s) ${busy} are already in use. Close any old Riseora/Node/Vite process and start Riseora ERP again.`,
      );
    }

    await createStartupBackupIfNeeded();

    /*
     * Some legacy services resolve relative paths from the process working
     * directory. Point them at the writable Riseora user-data area rather
     * than Program Files / the packaged ASAR.
     */
    process.chdir(ensureRuntimeFolders().businessData);

    const serverEntry = path.join(
      app.getAppPath(),
      "app",
      "server",
      "src",
      "app.js",
    );

    if (!fs.existsSync(serverEntry)) {
      throw new Error(
        `Packaged server entry was not found at ${serverEntry}.`,
      );
    }

    await import(pathToFileURL(serverEntry).href);
    await waitForBackend();

    /*
     * seedAdmin has now had its only required use of the one-time
     * first-run password. Remove it from persistent desktop config.
     */
    scrubInitialAdminPassword();

    await startFrontendServer();

    runtimeStarted = true;
    createMenu();
    await createMainWindow();
  } catch (error) {
    runtimeStarting = false;

    await dialog.showMessageBox({
      type: "error",
      title: "Riseora ERP could not start",
      message: "Riseora ERP could not start safely.",
      detail: String(error?.stack || error?.message || error),
    });

    app.quit();
    return;
  }

  runtimeStarting = false;
}

ipcMain.handle("riseora-setup:save", async (_event, payload) => {
  try {
    const config = saveDesktopConfig(payload || {});

    /*
     * Do not expose or echo secrets back to the renderer.
     */
    setTimeout(() => {
      startRuntime().catch(() => {
        // startRuntime already reports fatal startup errors.
      });
    }, 50);

    return {
      success: true,
      smtpConfigured: Boolean(config.smtp?.enabled),
    };
  } catch (error) {
    return {
      success: false,
      message: String(error?.message || error),
    };
  }
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      return;
    }

    if (setupWindow) {
      setupWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    ensureRuntimeFolders();
    app.setAppLogsPath(
      path.join(appPaths().logsDir),
    );

    const config = loadDesktopConfig();

    if (config) {
      await startRuntime();
    } else {
      createSetupWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  try {
    frontendServer?.close();
  } catch {
    // Process shutdown will close local listeners.
  }
});
