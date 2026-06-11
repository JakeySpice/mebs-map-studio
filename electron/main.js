// Electron shell for MEBS Map Studio.
// Serves the static Next.js export in `out/` over a custom app:// scheme so the
// renderer keeps a stable origin (localStorage must survive across launches).
const { app, BrowserWindow, protocol, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "out");
const APP_ORIGIN = "app://bundle";
// Smoke tests drive the app over the DevTools protocol; keep the window hidden.
const HIDDEN = process.env.MEBS_SMOKE === "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".wasm": "application/wasm",
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

async function fileIfExists(p) {
  try {
    const stat = await fs.promises.stat(p);
    return stat.isFile() ? p : null;
  } catch {
    return null;
  }
}

// Resolve a request path the way a static host would:
// exact file -> `<path>.html` -> `<path>/index.html` -> 404.html
async function resolveStatic(pathname) {
  const rel = path.normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");
  const base = path.join(OUT_DIR, rel);
  if (!base.startsWith(OUT_DIR)) return path.join(OUT_DIR, "404.html");
  return (
    (await fileIfExists(base)) ||
    (await fileIfExists(`${base}.html`)) ||
    (await fileIfExists(path.join(base, "index.html"))) ||
    path.join(OUT_DIR, "404.html")
  );
}

function registerAppProtocol() {
  protocol.handle("app", async (request) => {
    const { pathname } = new URL(request.url);
    const file = await resolveStatic(pathname);
    try {
      const body = await fs.promises.readFile(file);
      const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
      return new Response(body, { headers: { "content-type": type } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function isExternal(url) {
  return !url.startsWith(`${APP_ORIGIN}/`);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#161719",
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, "..", "build", "icon.ico"),
  });

  // The app is local-first; anything pointing off app:// opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isExternal(url)) {
      event.preventDefault();
      if (url.startsWith("https:") || url.startsWith("http:")) shell.openExternal(url);
    }
  });

  if (!HIDDEN) win.once("ready-to-show", () => win.show());
  win.loadURL(`${APP_ORIGIN}/`);
  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
