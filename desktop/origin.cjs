"use strict";

/** Hardcoded production origin. Desktop clients never read server secrets. */
const APP_ORIGIN = "https://poolindex.app";
const START_PATH = "/app";

const ALLOWED_HOSTS = new Set(["poolindex.app", "sandbox.paypal.com", "www.sandbox.paypal.com"]);

function hostnameOf(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isLivePaypal(urlString) {
  const host = hostnameOf(urlString);
  if (!host.endsWith("paypal.com")) return false;
  return host !== "sandbox.paypal.com" && host !== "www.sandbox.paypal.com";
}

function isAllowedNavigation(urlString) {
  if (!urlString || urlString === "about:blank") return true;
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (isLivePaypal(urlString)) return false;
  return ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
}

function isGoogleAuthStart(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname.toLowerCase() !== "poolindex.app") return false;
    return parsed.pathname === "/api/auth/google/start";
  } catch {
    return false;
  }
}

function isExternalHttps(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "https:" && !isLivePaypal(urlString) && !ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

module.exports = {
  APP_ORIGIN,
  START_PATH,
  START_URL: `${APP_ORIGIN}${START_PATH}`,
  UPDATE_FEED: `${APP_ORIGIN}/downloads`,
  VERSION_URL: `${APP_ORIGIN}/api/desktop/version`,
  ALLOWED_HOSTS: [...ALLOWED_HOSTS],
  isAllowedNavigation,
  isLivePaypal,
  isExternalHttps,
  isGoogleAuthStart,
};
