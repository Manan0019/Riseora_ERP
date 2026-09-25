# Riseora ERP — Production Desktop / Installer Setup

## Goal

Produce one normal Windows installer:

```text
Riseora-ERP-Setup-1.0.0.exe
```

The owner installs Riseora ERP and starts it from a Desktop/Start Menu shortcut. They do not need Node.js, Vite, PowerShell, or separate backend/frontend terminals.

## Data safety architecture

The installed application is replaceable. Business data is not stored in `Program Files`.

Riseora uses:

```text
%APPDATA%\Riseora ERP\business-data\data\riseora_erp.db
```

Automatic verified startup backups:

```text
%APPDATA%\Riseora ERP\business-data\backups\
```

Local desktop configuration:

```text
%APPDATA%\Riseora ERP\business-data\desktop-config.json
```

Uninstalling/upgrading the app does not intentionally delete the `business-data` folder.

## Security

The installer package contains:

- app source/build files
- runtime dependencies
- Riseora logo

It intentionally does **not** contain:

- `server/.env`
- Gmail App Password
- session secret
- development/live database

On the first owner launch, a local setup screen creates a random session secret and asks the owner to set a strong administrator password. SMTP is optional.

## Apply the kit

Copy these supplied files into:

```text
D:\Manan\Website\Riseora Herbals\Riseora ERP
```

The result should include:

```text
Riseora ERP\
  client\
  server\
  desktop\
  BUILD_RISEORA_INSTALLER.ps1
```

## Step 1 — test current source one last time

Do not reset the database.

Server regression:

```powershell
cd "D:\Manan\Website\Riseora Herbals\Riseora ERP\server"
npm run test:regression
```

Also run the actual-material test if the script is present:

```powershell
node scripts/testProductionActualMaterials.js
```

## Step 2 — install desktop build dependencies

```powershell
cd "D:\Manan\Website\Riseora Herbals\Riseora ERP\desktop"
npm install
```

## Step 3 — run the desktop version without installer

```powershell
npm start
```

A one-time setup window appears.

For this test, desktop data goes to:

```text
desktop\.dev-user-data\
```

Use test credentials/data here only.

Verify:

1. First-run setup opens.
2. Set administrator password.
3. Riseora opens without browser/PowerShell.
4. Login works.
5. Dashboard loads.
6. Purchase works.
7. Formula/Production works.
8. `+ Add Actual Material` works.
9. Sales works.
10. Invoice print/Save PDF works.
11. Reports work.
12. Settings Backup Now does not crash.
13. Close and reopen; data remains.
14. A startup backup appears after reopening when a database exists.

## Step 4 — build the installer

Easiest:

```powershell
cd "D:\Manan\Website\Riseora Herbals\Riseora ERP"
.\BUILD_RISEORA_INSTALLER.ps1
```

Or manually:

```powershell
cd "D:\Manan\Website\Riseora Herbals\Riseora ERP\desktop"
npm run build:win
```

Expected:

```text
D:\Manan\Website\Riseora Herbals\Riseora ERP\desktop\release\Riseora-ERP-Setup-1.0.0.exe
```

## Step 5 — test the real installer

Preferably use another Windows user profile or another Windows PC.

1. Run `Riseora-ERP-Setup-1.0.0.exe`.
2. Complete installer.
3. Launch from Desktop shortcut.
4. First-run setup should appear.
5. Set the owner administrator password.
6. Configure SMTP if desired.
7. Login as `ram`.
8. Confirm the 210 default catalog items.
9. Enter temporary test data.
10. Restart the PC/app and verify data remains.
11. Upgrade/reinstall the same version and confirm business data remains.

Only after this test should the installer be given to the owner for live use.

## Code signing

The installer can be tested unsigned. Windows may show an Unknown Publisher / SmartScreen warning.

For broad/public distribution, add Windows Authenticode code signing before release.
