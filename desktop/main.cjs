"use strict";

const { app, BrowserWindow, shell, session, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const engineHost = require("./engine-host.cjs");
const {
  APP_ORIGIN,
  START_URL,
  UPDATE_FEED,
  isAllowedNavigation,
  isExternalHttps,
  isLivePaypal,
  isGoogleAuthStart,
} = require("./origin.cjs");

app.setName("PoolIndex");
app.setAppUserModelId("app.poolindex.desktop");
const PROTOCOL = "poolindex";
if (process.defaultApp) {
  if (process.argv.length >= 2) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

let desktopChallenge = "";

function newChallenge() {
  desktopChallenge = randomBytes(32).toString("base64url");
  return desktopChallenge;
}

function googleStartFromPayload(payload) {
  const url = new URL("https://poolindex.app/api/auth/google/start");
  url.searchParams.set("intent", payload?.intent === "register" ? "register" : "login");
  url.searchParams.set("next", typeof payload?.next === "string" ? payload.next : "/app");
  url.searchParams.set("desktop", "1");
  url.searchParams.set("challenge", newChallenge());
  if (payload?.inviteCode) url.searchParams.set("inviteCode", String(payload.inviteCode));
  if (payload?.acceptTerms) url.searchParams.set("acceptTerms", "1");
  if (payload?.acceptPrivacy) url.searchParams.set("acceptPrivacy", "1");
  return url.toString();
}

function openGoogleInSystemBrowser(target) {
  const url = new URL(target);
  url.searchParams.set("desktop", "1");
  url.searchParams.set("challenge", newChallenge());
  void shell.openExternal(url.toString());
}

function handleProtocolUrl(raw) {
  if (!raw || !String(raw).startsWith(`${PROTOCOL}:`)) return;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return;
  }
  const ticket = parsed.searchParams.get("ticket") || "";
  if (!ticket || !desktopChallenge) return;
  const complete = new URL("https://poolindex.app/api/auth/google/desktop");
  complete.searchParams.set("ticket", ticket);
  complete.searchParams.set("challenge", desktopChallenge);
  const win = BrowserWindow.getAllWindows()[0];
  if (win) void win.loadURL(complete.toString());
}

function destroyAllWindows() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.destroy();
  }
}

function quitPoolIndex() {
  destroyAllWindows();
  app.quit();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.exit(0);
} else {
  app.on("second-instance", (_event, argv) => {
    const proto = argv.find((arg) => String(arg).startsWith(`${PROTOCOL}:`));
    if (proto) handleProtocolUrl(proto);
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 640,
    title: "PoolIndex",
    backgroundColor: "#0b0f14",
    autoHideMenuBar: true,
    icon: path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleAuthStart(url)) {
      openGoogleInSystemBrowser(url);
      return { action: "deny" };
    }
    if (isAllowedNavigation(url)) return { action: "allow" };
    if (isExternalHttps(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (isGoogleAuthStart(url)) {
      event.preventDefault();
      openGoogleInSystemBrowser(url);
      return;
    }
    if (isAllowedNavigation(url)) return;
    event.preventDefault();
    if (isExternalHttps(url) && !isLivePaypal(url)) void shell.openExternal(url);
  });

  win.webContents.on("will-redirect", (event, url) => {
    if (isGoogleAuthStart(url)) {
      event.preventDefault();
      openGoogleInSystemBrowser(url);
      return;
    }
    if (isAllowedNavigation(url)) return;
    event.preventDefault();
  });

  win.webContents.on("did-fail-load", (_event, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;
    void win.loadFile(path.join(__dirname, "offline.html"), { query: { reason: desc || String(code), url } });
  });

  void win.loadURL(START_URL);
  return win;
}

function configureUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.setFeedURL({ provider: "generic", url: UPDATE_FEED });
  autoUpdater.on("error", () => {
    /* Closed Beta: fail closed and stay on the current build. Never log feed bodies. */
  });
  void autoUpdater.checkForUpdates().catch(() => undefined);
}

ipcMain.handle("google-auth-start", (_event, payload) => {
  void shell.openExternal(googleStartFromPayload(payload || {}));
  return { ok: true };
});

function publicAddressArg(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 64) return "";
  return text;
}

ipcMain.handle("engine:scanWallet", async (_event, address) => {
  engineHost.start(app.getPath("userData"));
  return engineHost.call("scan", publicAddressArg(address));
});

ipcMain.handle("engine:pollWallet", async (_event, address) => {
  engineHost.start(app.getPath("userData"));
  return engineHost.call("poll", publicAddressArg(address));
});

app.whenReady().then(async () => {
  const ses = session.defaultSession;
  ses.setUserAgent(`${ses.getUserAgent()} PoolIndexDesktop`);
  await ses.cookies.set({
    url: APP_ORIGIN,
    name: "poolindex_desktop",
    value: "1",
    path: "/",
    secure: true,
    httpOnly: false,
    sameSite: "lax",
  }).catch(() => undefined);
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (details, callback) => {
    if (isLivePaypal(details.url)) {
      callback({ cancel: true });
      return;
    }
    callback({});
  });
  createWindow();
  configureUpdater();
  const proto = process.argv.find((arg) => String(arg).startsWith(`${PROTOCOL}:`));
  if (proto) handleProtocolUrl(proto);
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

app.on("before-quit", () => {
  engineHost.stop();
  destroyAllWindows();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") quitPoolIndex();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
