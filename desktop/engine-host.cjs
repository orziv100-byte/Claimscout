"use strict";

const { existsSync } = require("node:fs");
const { fork } = require("node:child_process");
const path = require("node:path");

let child = null;
let seq = 0;
const pending = new Map();
const CALL_TIMEOUT_MS = 180_000;

function engineScript() {
  const packed = path.join(process.resourcesPath || "", "engine.cjs");
  const local = path.join(__dirname, "engine.cjs");
  if (existsSync(packed)) return packed;
  return local;
}

function failAll(error) {
  for (const wait of pending.values()) wait.reject(error);
  pending.clear();
}

function start(userData) {
  if (child && child.connected) return child;
  const script = engineScript();
  if (!existsSync(script)) {
    throw new Error("Local wallet engine is not packaged in this desktop build.");
  }
  const engineDir = path.join(userData, "engine");
  child = fork(script, [], {
    env: {
      ...process.env,
      POOLINDEX_ENGINE_DIR: engineDir,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  child.on("message", (msg) => {
    if (!msg || typeof msg !== "object") return;
    const wait = pending.get(msg.id);
    if (!wait) return;
    pending.delete(msg.id);
    if (msg.error) wait.reject(new Error(String(msg.error)));
    else wait.resolve(msg.result);
  });
  child.on("exit", () => {
    child = null;
    failAll(new Error("Local engine stopped"));
  });
  child.on("error", (err) => {
    child = null;
    failAll(err instanceof Error ? err : new Error("Local engine failed"));
  });
  return child;
}

function call(op, address) {
  return new Promise((resolve, reject) => {
    if (!child || !child.connected) {
      reject(new Error("Local engine is not running"));
      return;
    }
    const id = ++seq;
    pending.set(id, { resolve, reject });
    child.send({ id, op, address });
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error("Local engine timed out"));
    }, CALL_TIMEOUT_MS);
  });
}

function stop() {
  if (!child) return;
  child.removeAllListeners("exit");
  child.kill();
  child = null;
  failAll(new Error("Local engine stopped"));
}

module.exports = { start, call, stop };
