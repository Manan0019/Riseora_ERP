const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("riseoraReports", {
  savePdf: (title, paper) => ipcRenderer.invoke("riseora-reports:save-pdf", title, paper),
});
