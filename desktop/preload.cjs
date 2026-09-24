"use strict";

const { contextBridge, ipcRenderer } = require("electron");
const { version } = require("./package.json");

contextBridge.exposeInMainWorld("poolindexDesktop", {
  shell: "poolindex-desktop",
  platform: process.platform,
  version,
  startGoogleAuth: (payload) => ipcRenderer.invoke("google-auth-start", payload),
  scanWallet: (address) => ipcRenderer.invoke("engine:scanWallet", address),
  pollWallet: (address) => ipcRenderer.invoke("engine:pollWallet", address),
});
