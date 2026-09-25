# Riseora ERP — Windows Installer Kit

This folder converts the existing working Riseora ERP V1.0 source into a Windows desktop application and NSIS installer.

## What it does

- Builds the React frontend for production.
- Copies the current `server/src` and `client/dist` into a generated desktop payload.
- Does **not** copy `server/.env`.
- Does **not** copy `data/riseora_erp.db`.
- Locks the packaged Express backend to `127.0.0.1`.
- Starts the backend internally when Riseora ERP launches.
- Serves the built React UI internally on port 5173.
- Stores business data outside the installed application.
- Creates an automatic verified database backup before normal startup when a DB already exists.
- Keeps the latest 30 automatic startup backups.
- Prevents multiple Riseora instances.
- Provides a first-run setup screen for the administrator password and optional SMTP configuration.

## Owner data location

Normal installed build:

```text
%APPDATA%\Riseora ERP\business-data\
```

Important files:

```text
business-data\data\riseora_erp.db
business-data\backups\
business-data\desktop-config.json
business-data\logs\
```

Do not delete `business-data` when upgrading Riseora.

## First owner launch

On the first launch, Riseora asks for:

- Administrator password for user `ram`
- Optional SMTP email / App Password for Forgot Password

No Gmail App Password is embedded into the installer.

The one-time administrator password is used to seed the first database and is then removed from the persistent desktop configuration.

After setup, normal Riseora migrations run and the owner catalog is seeded into the new local database.

## Build prerequisites

- Windows 10/11 x64
- Node.js + npm on the development PC
- Existing Riseora client/server already working

The owner PC does **not** need Node.js.

## First installation of desktop build dependencies

PowerShell:

```powershell
cd "D:\Manan\Website\Riseora Herbals\Riseora ERP\desktop"
npm install
```

`electron-builder install-app-deps` runs automatically after install so native modules such as `better-sqlite3` and `bcrypt` match Electron.

## Test the desktop app before building the installer

```powershell
cd "D:\Manan\Website\Riseora Herbals\Riseora ERP\desktop"
npm start
```

Development desktop testing uses:

```text
desktop\.dev-user-data\
```

so it does not use the final installed owner's `%APPDATA%` database.

## Build unpacked Windows app

Useful before creating the installer:

```powershell
npm run build:dir
```

## Build final Windows installer

```powershell
npm run build:win
```

Expected installer:

```text
desktop\release\Riseora-ERP-Setup-1.0.0.exe
```

Give that installer to the owner.

## Important

Do **not** run the old production reset command as part of installer building.

The installer intentionally starts with no business transaction database. On first owner launch the ERP creates a clean local database using the existing migrations and seeds.

## Unsigned installer

The first trial installer can be built without a code-signing certificate. Windows may show **Unknown publisher / SmartScreen**.

Before broader distribution outside the owner/test group, sign the Windows executable/installer with a trusted code-signing certificate.
