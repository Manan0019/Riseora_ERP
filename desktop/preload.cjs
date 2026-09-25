const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("riseoraDesktopSetup", {
  save: (payload) =>
    ipcRenderer.invoke("riseora-setup:save", payload),
});
