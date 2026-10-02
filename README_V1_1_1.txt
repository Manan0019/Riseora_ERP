RISEORA ERP V1.1.1 - TAB STATE + CATEGORY / ITEM FILTER UPDATE
================================================================

TARGET
------
This patch is for the development project after V1.1 has already been applied.
It is intended to be built into Riseora-ERP-Setup-1.1.1.exe.

DATA SAFETY
-----------
This update does NOT contain a SQLite database and does not alter/reset owner
business data. Existing item/category IDs and links remain unchanged.

DO NOT run server/scripts/prepareProduction.js or npm run prepare:production on
the owner's live database.

CHANGES
-------
1. TRUE KEEP-ALIVE IN-APP TABS
   - Each open Riseora tab keeps its React page instance mounted.
   - Switching from an unfinished Purchase/Sales/other entry to another tab no
     longer destroys the form state.
   - Return to the original tab and the entered values/rows remain.
   - Purchase/Sales lookups refresh on tab activation, so a newly created supplier/customer/item becomes available without clearing the draft.
   - Closing a tab intentionally discards that tab's unsaved in-memory state.
   - Reload Tab intentionally remounts only that tab.
   - Full desktop/browser restart is not an autosave operation; posted data is
     still stored normally in SQLite.

2. POPUPS WITH KEEP-ALIVE TABS
   - Hidden tabs keep their page state, but their portal popup is hidden.
   - When returning to the tab, its popup and unsaved form state reappear.

3. CATEGORY CODE REMOVED FROM OWNER UI
   - Category code is no longer entered, displayed or searched by the owner.
   - Existing database codes remain untouched internally for backward
     compatibility and data safety.
   - New categories receive an automatic internal CAT-xxxxx code.
   - Category Name remains editable.
   - Inventory Role remains locked after items are assigned because RAW/PACK/FG
     controls production, stock and sales behaviour.

4. VIEW ITEMS FROM CATEGORY
   - Each category has a View Items button.
   - The popup title includes the selected category name.
   - Shows every active/inactive item belonging to that category.
   - Search within the popup by item name, unit or HSN.

5. ITEM CATEGORY FILTER
   - Item Master now has an All Categories dropdown.
   - Select a category to display only its items.
   - Item text search uses item name/category/unit/HSN instead of category code.

6. VERSION
   - Desktop package version: 1.1.1
   - Sidebar version label: 1.1.1

APPLY
-----
From the extracted patch folder run:

PowerShell -ExecutionPolicy Bypass -File .\APPLY_V1_1_1_UPDATE.ps1

Default project location:
D:\Manan\Website\Riseora Herbals\Riseora ERP

Then:

cd "D:\Manan\Website\Riseora Herbals\Riseora ERP\client"
npm run build

Then test Electron:

cd "D:\Manan\Website\Riseora Herbals\Riseora ERP\desktop"
npm start

After runtime testing:

npm run build:win

Expected installer:
desktop\release\Riseora-ERP-Setup-1.1.1.exe

OWNER INSTALLATION
------------------
1. In current ERP: Settings -> Backup Now.
2. Close Riseora completely.
3. Copy %APPDATA%\Riseora ERP\business-data to a safe backup folder.
4. Run Riseora-ERP-Setup-1.1.1.exe over the existing installation.
5. DO NOT uninstall/delete %APPDATA%\Riseora ERP.
6. DO NOT copy the development riseora_erp.db to the owner laptop.
7. Verify old items, suppliers, stock, purchases, sales and production history.
8. Test the new V1.1.1 UI changes.

RUNTIME TESTS
-------------
A. Draft tab preservation
- Start Purchase Entry and fill supplier + 2 item rows + values.
- Open Customers or Items in a new tab.
- Return to Purchase Entry.
- All original values and rows must still be present.
- Repeat with Sales Invoice.

B. Category
- Category list must show no Code column.
- Edit a category name and save.
- Restart app; name must remain.
- New category requires only Name + Inventory Role.

C. View Items
- Click View Items for a category.
- Popup title must include that category name.
- Only items assigned to that category should be listed.

D. Item filter
- Select a category in Item Master.
- Only items belonging to that category should remain visible.
- Clear the filter to restore all items.

E. Existing owner data
- Verify owner-created item/supplier/customer records.
- Verify known stock balances.
- Verify recent purchase/sales/production records.
