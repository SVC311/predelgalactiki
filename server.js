// Сервер онлайн-партий «Пределов Галактики». Без зависимостей: node server.js
// Раздаёт статику и хранит комнаты. Ходы передаются целым состоянием партии с номером версии.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");

const PORT = +process.env.PORT || 8080;
const ROOT = __dirname;
const DATA = process.env.DATA_DIR || path.join(ROOT, "data");
const TTL = 7 * 24 * 3600 * 1000; // комната живёт неделю без активности
const MAX_BODY = 512 * 1024;
fs.mkdirSync(DATA, { recursive: true });

const rooms = new Map(); // code → {code, ver, state, fx, seats:[token|null, token|null], names, touched}
const waiters = new Map(); // code → Set of {res, timer}

const roomFile = code => path.join(DATA, code + ".json");
function loadRoom(code) {
  if (rooms.has(code)) return rooms.get(code);
  try { const r = JSON.parse(fs.readFileSync(roomFile(code), "utf8")); rooms.set(code, r); return r; } catch { return null; }
}
function saveRoom(r) { r.touched = Date.now(); fs.writeFile(roomFile(r.code), JSON.stringify(r), () => {}); }
function newCode() { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c; do { c = Array.from(crypto.randomBytes(5), b => A[b % A.length]).join(""); } while (loadRoom(c)); return c; }
const pub = r => ({ code: r.code, ver: r.ver, state: r.state, fx: r.fx || [], joined: r.seats.map(Boolean), names: r.names });

function notify(r) {
  const set = waiters.get(r.code); if (!set) return;
  waiters.delete(r.code);
  for (const w of set) { clearTimeout(w.timer); send(w.res, 200, pub(r)); }
}
function send(res, code, obj) {
  if (res.writableEnded) return;
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((ok, fail) => {
    let n = 0; const parts = [];
    req.on("data", c => { n += c.length; if (n > MAX_BODY) { fail(new Error("too big")); req.destroy(); } else parts.push(c); });
    req.on("end", () => { try { ok(parts.length ? JSON.parse(Buffer.concat(parts).toString("utf8")) : {}); } catch (e) { fail(e); } });
  });
}

async function api(req, res, parts) {
  // POST /api/room                → создать комнату, игрок 1
  // POST /api/room/CODE/join      → занять свободное место, игрок 2
  // GET  /api/room/CODE?since=V   → состояние (ждёт до 25 с, если версия не изменилась)
  // POST /api/room/CODE/state     → записать новое состояние {token, ver, state, fx}
  const [, , code, action] = parts;
  if (req.method === "POST" && !code) {
    const b = await body(req);
    const r = { code: newCode(), ver: 1, state: b.state || null, fx: [], seats: [crypto.randomUUID(), null], names: [String(b.name || "Игрок 1").slice(0, 24), null], touched: Date.now() };
    rooms.set(r.code, r); saveRoom(r);
    return send(res, 200, { ...pub(r), seat: 0, token: r.seats[0] });
  }
  const r = code && loadRoom(code.toUpperCase());
  if (!r) return send(res, 404, { error: "Комната не найдена" });
  if (req.method === "POST" && action === "join") {
    const b = await body(req);
    const mine = r.seats.indexOf(b.token);
    if (b.token && mine >= 0) return send(res, 200, { ...pub(r), seat: mine, token: b.token });
    const free = r.seats.indexOf(null);
    if (free < 0) return send(res, 409, { error: "В комнате уже два игрока" });
    r.seats[free] = crypto.randomUUID(); r.names[free] = String(b.name || "Игрок " + (free + 1)).slice(0, 24); r.ver++;
    saveRoom(r); notify(r);
    return send(res, 200, { ...pub(r), seat: free, token: r.seats[free] });
  }
  if (req.method === "POST" && action === "state") {
    const b = await body(req);
    if (r.seats.indexOf(b.token) < 0) return send(res, 403, { error: "Вы не участник этой партии" });
    if (b.ver !== r.ver) return send(res, 409, { error: "Состояние устарело", ...pub(r) });
    r.state = b.state; r.fx = Array.isArray(b.fx) ? b.fx.slice(0, 40) : []; r.ver++;
    saveRoom(r); notify(r);
    return send(res, 200, pub(r));
  }
  if (req.method === "GET" && !action) {
    const since = +new URL(req.url, "http://x").searchParams.get("since") || 0;
    if (r.ver !== since) return send(res, 200, pub(r));
    const w = { res, timer: setTimeout(() => { waiters.get(r.code)?.delete(w); send(res, 200, pub(r)); }, 25000) };
    if (!waiters.has(r.code)) waiters.set(r.code, new Set());
    waiters.get(r.code).add(w);
    req.on("close", () => { clearTimeout(w.timer); waiters.get(r.code)?.delete(w); });
    return;
  }
  send(res, 404, { error: "Неизвестный запрос" });
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".mp3": "audio/mpeg", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
function stat(req, res, p) {
  if (p === "/") p = "/index.html";
  const f = path.normalize(path.join(ROOT, decodeURIComponent(p)));
  const top = path.relative(ROOT, f).split(path.sep)[0];
  if (!f.startsWith(ROOT + path.sep) || !["index.html", "art", "sfx"].includes(top)) { res.writeHead(404); return res.end("Not found"); }
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": top === "index.html" ? "no-cache" : "public, max-age=86400" });
    fs.createReadStream(f).pipe(res);
  });
}

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"), parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] === "api" && parts[1] === "room") return api(req, res, parts).catch(() => send(res, 400, { error: "Плохой запрос" }));
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  stat(req, res, u.pathname);
}).listen(PORT, () => console.log(`Пределы Галактики: http://localhost:${PORT}`));

// уборка старых комнат раз в час
setInterval(() => {
  const now = Date.now();
  for (const f of fs.readdirSync(DATA)) {
    if (!f.endsWith(".json")) continue;
    try { const r = JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")); if (now - r.touched > TTL) { fs.unlinkSync(path.join(DATA, f)); rooms.delete(r.code); } } catch {}
  }
}, 3600 * 1000).unref();
