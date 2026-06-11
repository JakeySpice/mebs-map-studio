// Drives a running MEBS Map Studio shell over the Chrome DevTools Protocol.
// Launch the app with --remote-debugging-port=<port> (and MEBS_SMOKE=1 to keep
// the window hidden), then: node scripts/smoke.js <port> <screenshot.png>
// Exercises: home page load -> sample map creation -> canvas render -> storage.
const fs = require("fs");

const port = process.argv[2] || "9222";
const shot = process.argv[3] || "smoke.png";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.url.startsWith("app://"));
      if (page) return page;
    } catch {}
    await sleep(500);
  }
  throw new Error("no app:// page target appeared on the debug port");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    ws.onopen = () =>
      resolve({
        ws,
        send(method, params = {}) {
          return new Promise((res, rej) => {
            const msgId = ++id;
            pending.set(msgId, { res, rej });
            ws.send(JSON.stringify({ id: msgId, method, params }));
          });
        },
      });
    ws.onerror = reject;
    ws.onclose = () => {
      for (const { rej } of pending.values()) rej(new Error("CDP socket closed"));
      pending.clear();
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    };
  });
}

async function main() {
  const target = await pageTarget();
  const cdp = await connect(target.webSocketDebuggerUrl);
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(`page threw: ${exceptionDetails.text}`);
    return result.value;
  };

  await cdp.send("Page.enable");

  // fresh slate so reruns don't accumulate sample maps
  await evaluate("localStorage.clear(); location.assign('app://bundle/'); 'ok'");
  await sleep(2500);

  const home = await evaluate(
    "JSON.stringify({ title: document.title, h1: document.querySelector('h1')?.innerText, url: location.href })"
  );
  console.log("home:", home);
  const homeState = JSON.parse(home);
  if (homeState.h1 !== "MEBS Map Studio") throw new Error("home page did not render");

  // open the bundled sample map
  await evaluate(
    "[...document.querySelectorAll('button')].find(b => b.textContent.includes('sample')).click(); 'clicked'"
  );
  await sleep(3000);

  const map = await evaluate(
    "JSON.stringify({ url: location.href, nodes: document.querySelectorAll('.react-flow__node').length, storedMaps: JSON.parse(localStorage.getItem('mebs-map-studio:index') || '[]').length })"
  );
  console.log("map:", map);
  const mapState = JSON.parse(map);
  if (!mapState.url.includes("/map?id=")) throw new Error("did not navigate to /map?id=…");
  if (mapState.nodes < 2) throw new Error("react-flow canvas did not render nodes");
  if (mapState.storedMaps !== 1) throw new Error("map was not persisted to localStorage");

  await sleep(800); // let fitView animation settle before the screenshot
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(shot, Buffer.from(data, "base64"));
  console.log("screenshot:", shot);

  console.log("SMOKE OK");
  cdp.ws.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err.message);
  process.exit(1);
});
