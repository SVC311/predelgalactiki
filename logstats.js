// Сводка по журналам партий. Используется сервером (страница /logs) и из командной строки:
//   node logstats.js                  — папка data/logs рядом со скриптом
//   node logstats.js путь/к/файлу.jsonl  — выгрузка со страницы /logs
"use strict";
const fs = require("fs"), path = require("path");

const RACE = { dorg: "Дорги", xar: "Ксарионы", vel: "Велары" };
const MODE = { local: "на одном экране", ai: "против ИИ", net: "по сети" };
const UNIT = { scout: "разведчик", fighter: "боец", heavy: "тяжёлый", spec: "специалист", giant: "гигант", tower: "башня" };
const STALE = 24 * 3600 * 1000; // партия без ходов дольше суток считается брошенной

function readDir(dir) {
  let names = [];
  try { names = fs.readdirSync(dir).filter(f => f.endsWith(".json")); } catch { return []; }
  const out = [];
  for (const f of names) { try { out.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))); } catch {} }
  return out.sort((a, b) => (a.started || 0) - (b.started || 0));
}
function readJsonl(file) {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";
const avg = a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length * 10) / 10 : "—";

function summary(games, now = Date.now()) {
  const done = games.filter(g => g.winner === 0 || g.winner === 1);
  const open = games.filter(g => g.winner == null);
  const s = {
    total: games.length, finished: done.length,
    abandoned: open.filter(g => now - (g.updated || 0) > STALE).length,
    playing: open.filter(g => now - (g.updated || 0) <= STALE).length,
    byMode: {}, races: {}, matchups: {}, firstWins: 0,
    rounds: avg(done.map(g => g.round)), minutes: avg(done.map(g => g.minutes || 0)),
    hires: {}, builds: {}, recent: games.slice(-30).reverse(),
  };
  for (const g of games) s.byMode[g.mode] = (s.byMode[g.mode] || 0) + 1;
  for (const r in RACE) s.races[r] = { games: 0, wins: 0, rounds: [] };
  for (const g of done) {
    if (g.winner === g.first) s.firstWins++;
    const [a, b] = g.races, w = g.races[g.winner];
    if (a !== b) { // зеркальные партии ничего не говорят о силе расы
      for (const r of [a, b]) if (s.races[r]) { s.races[r].games++; s.races[r].rounds.push(g.round); }
      if (s.races[w]) s.races[w].wins++;
      const key = [a, b].sort().join("|"), m = s.matchups[key] || (s.matchups[key] = { games: 0, wins: {} });
      m.games++; m.wins[w] = (m.wins[w] || 0) + 1;
    }
  }
  for (const g of games) for (const e of g.ev || []) {
    const r = g.races && g.races[e.p];
    if (e.a === "hire") { const h = s.hires[r] || (s.hires[r] = {}); h[e.t] = (h[e.t] || 0) + 1; }
    if (e.a === "build") { const b = s.builds[r] || (s.builds[r] = {}); b[e.t] = (b[e.t] || 0) + 1; }
  }
  return s;
}

function text(s) {
  const L = [];
  L.push(`Партий всего: ${s.total}. Доиграно: ${s.finished}, идут: ${s.playing}, брошено: ${s.abandoned}.`);
  L.push("Режимы: " + (Object.entries(s.byMode).map(([m, n]) => `${MODE[m] || m} ${n}`).join(", ") || "—"));
  L.push(`Доигранные: в среднем ${s.rounds} раундов, ${s.minutes} мин. Первый ходящий победил в ${pct(s.firstWins, s.finished)}.`);
  L.push("", "Расы (без зеркальных партий):");
  for (const [r, x] of Object.entries(s.races)) L.push(`  ${RACE[r]}: партий ${x.games}, побед ${x.wins} (${pct(x.wins, x.games)}), раундов в среднем ${avg(x.rounds)}`);
  L.push("", "Пары рас:");
  for (const [k, m] of Object.entries(s.matchups)) L.push(`  ${k.split("|").map(r => RACE[r]).join(" — ")}: ${m.games} партий; ` + Object.entries(m.wins).map(([r, n]) => `${RACE[r]} ${n}`).join(", "));
  L.push("", "Наймы по расам:");
  for (const [r, h] of Object.entries(s.hires)) L.push(`  ${RACE[r] || r}: ` + Object.entries(h).map(([t, n]) => `${UNIT[t] || t} ${n}`).join(", "));
  return L.join("\n");
}

const esc = v => String(v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function html(s, dl) {
  const day = t => t ? new Date(t).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) : "—";
  const rows = s.recent.map(g => `<tr><td>${day(g.started)}</td><td>${MODE[g.mode] || esc(g.mode)}</td><td>${(g.races || []).map(r => RACE[r] || esc(r)).join(" — ")}</td><td>${g.winner == null ? "—" : RACE[g.races[g.winner]] || ""}</td><td>${g.round}</td><td>${g.minutes ?? "—"}</td><td>${(g.ev || []).length}</td></tr>`).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Журнал партий</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;background:#0e1220;color:#e6e9f2;max-width:960px;margin:auto}a{color:#7cc4ff}pre{white-space:pre-wrap;background:#161b2e;padding:12px;border-radius:8px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:4px 8px;border-bottom:1px solid #2a3150;text-align:left}.wrap{overflow-x:auto}</style></head>
<body><h1>Журнал партий</h1><p><a href="${dl}">Скачать все партии (JSONL)</a> · сводку можно получить и командой <code>node logstats.js файл.jsonl</code></p>
<pre>${esc(text(s))}</pre><h2>Последние партии</h2><div class="wrap"><table><tr><th>Начало (МСК)</th><th>Режим</th><th>Расы</th><th>Победа</th><th>Раундов</th><th>Минут</th><th>Событий</th></tr>${rows}</table></div></body></html>`;
}

module.exports = { readDir, summary, text, html };

if (require.main === module) {
  const arg = process.argv[2];
  const games = arg && fs.statSync(arg).isFile() ? readJsonl(arg) : readDir(arg || path.join(__dirname, "data", "logs"));
  console.log(text(summary(games)));
}
