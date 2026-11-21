#!/usr/bin/env node
// AIGI table timer. One small server, no dependencies.
//   node table/server.js          prints the links
//   /        portal            /play   participants (pick a table, then a role)            /gm   game master            /watch   observers
// Env: PORT (2424), AIGI_KEY (game master key; with none set, /gm is open), AIGI_STATE (where state.json lives, e.g. a mounted volume).
// The clock is a phase and an end time, so every device counts down by itself and keeps time if the connection drops.
// Each device is sent only the items addressed to everyone, its table or its role.
// A film is an id and a start time, the same idea as the clock: an observer who joins late lands at the right point in it.
// Tables, roles, minutes and the participant code are edited by the game master and kept in state.json; content.json seeds them
// and holds the days, questions and items.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');

const DIR = __dirname, PUB = path.join(DIR, 'public'), STATE_FILE = process.env.AIGI_STATE || path.join(DIR, 'state.json');
const PORT = +process.env.PORT || 2424;
const loadContent = () => JSON.parse(fs.readFileSync(path.join(DIR, 'content.json'), 'utf8'));
let content = loadContent();
fs.watchFile(path.join(DIR, 'content.json'), { interval: 1000 }, () => { try { content = loadContent(); broadcast(); } catch (e) { console.error('content.json: ' + e.message); } });

const seedSetup = () => ({ teams: content.teams.map((t) => ({ id: t.id, name: t.name, roles: (t.roles || []).map((r) => ({ ...r })) })),
  minutes: Object.fromEntries(content.phases.map((p) => [p.id, p.minutes])), joinCode: '' });
const fresh = () => ({ day: content.days[0].id, phase: null, running: false, endsAt: 0, remainingMs: 0, durationMs: 0, sent: [], step: {}, decisions: {}, film: null, identifyUntil: 0, setup: seedSetup() });
let state = fresh();
try { const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); state = Object.assign(fresh(), s); if (!s.setup) state.setup = seedSetup(); } catch {}
const KEY = process.env.AIGI_KEY || '';   // no key unless one is set: fine in the room, set one before hosting it on a public address
delete state.key;
let saveT = null;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(state, null, 1)); fs.renameSync(STATE_FILE + '.tmp', STATE_FILE); } catch (e) { console.error('save: ' + e.message); } }, 150); };

const S = () => state.setup;
const day = () => content.days.find((d) => d.id === state.day) || content.days[0];
const phases = () => content.phases.map((p) => ({ id: p.id, name: p.name, minutes: S().minutes[p.id] ?? p.minutes }));
const timer = () => ({ phase: state.phase, running: state.running, endsAt: state.endsAt, remainingMs: state.remainingMs, durationMs: state.durationMs });
const allRoles = () => S().teams.flatMap((t) => t.roles);
const newId = (name) => { const used = new Set(['all', ...S().teams.map((t) => t.id), ...allRoles().map((r) => r.id)]);
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'seat'; let id = base, n = 2; while (used.has(id)) id = `${base}-${n++}`; return id; };
const clean = (s, max = 60) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// what one device is allowed to see
function tableView(teamId, roleId) {
  const team = S().teams.find((t) => t.id === teamId);
  if (!team) return { now: Date.now(), title: content.title, gone: true };
  const role = team.roles.find((r) => r.id === roleId) || null, d = day();
  const feed = state.sent.filter((s) => s.day === d.id && (s.to === 'all' || s.to === team.id || (role && s.to === role.id))).map((s) => {
    const item = s.note ? { type: 'note', text: s.note } : d.items.find((i) => i.id === s.id);
    return item && { ...item, to: undefined, key: s.key, at: s.at, only: s.to === 'all' ? '' : s.to === team.id ? team.name : role.name };
  }).filter(Boolean).reverse();
  return { now: Date.now(), title: content.title, team: { id: team.id, name: team.name }, role: role && { id: role.id, name: role.name }, day: { id: d.id, name: d.name },
    phases: phases(), ...timer(), identifyUntil: state.identifyUntil, questions: state.phase === 'decide' ? d.questions : [], feed };
}
// what an observer sees: the film playing now (only that one, never the versions the room didn't pick), the clock, and what went to everyone
const filmList = () => (content.films && content.films.list) || {};
function watchView() {
  const d = day(), f = state.film && filmList()[state.film.id];
  const feed = state.sent.filter((s) => s.day === d.id && s.to === 'all').map((s) => {
    const item = s.note ? { type: 'note', text: s.note } : d.items.find((i) => i.id === s.id);
    return item && { ...item, to: undefined, key: s.key, at: s.at };
  }).filter(Boolean).reverse();
  const decided = content.days.filter((x) => state.decisions[x.id]).map((x) => ({ day: x.name, q: ((x.questions || [])[0] || {}).q || '', choice: state.decisions[x.id] }));
  return { now: Date.now(), title: content.title, about: content.about || '', day: { id: d.id, name: d.name, background: d.background || '' }, days: content.days.map((x) => ({ id: x.id, name: x.name })),
    tables: S().teams.map((t) => t.name), phases: phases(), ...timer(), questions: state.phase === 'decide' ? d.questions : [], decided, feed,
    film: f ? { src: content.films.embed + f.video, at: state.film.at, seconds: f.seconds } : null };
}
function controlView() {
  const counts = {}; let watching = 0; for (const c of clients) if (c.watch) watching++; else if (!c.control) { counts[c.team] = (counts[c.team] || 0) + 1; if (c.role) counts[c.role] = (counts[c.role] || 0) + 1; }
  return { now: Date.now(), title: content.title, setup: S(), days: content.days, phases: phases(), day: state.day, step: state.step[state.day] || 0, decisions: state.decisions, ...timer(), sent: state.sent, counts, watching, films: filmList(), film: state.film };
}

const clients = new Set();
const push = (c) => c.res.write(`data: ${JSON.stringify(c.control ? controlView() : c.watch ? watchView() : tableView(c.team, c.role))}\n\n`);
function broadcast() { for (const c of clients) push(c); }
setInterval(broadcast, 10000); // heartbeat: keeps the connection open and the clocks in step

const clearClock = () => Object.assign(state, { phase: null, running: false, endsAt: 0, remainingMs: 0, durationMs: 0 });
const commands = {
  // the clock
  day({ day: id }) { if (content.days.some((d) => d.id === id)) { state.day = id; state.film = null; clearClock(); } },
  start({ phase }) { const p = phases().find((x) => x.id === phase); if (!p) return; const ms = p.minutes * 60000;
    Object.assign(state, { phase, running: true, endsAt: Date.now() + ms, remainingMs: ms, durationMs: ms }); },
  pause() { if (!state.phase || !state.running) return; state.remainingMs = Math.max(0, state.endsAt - Date.now()); state.running = false; },
  resume() { if (!state.phase || state.running) return; state.endsAt = Date.now() + state.remainingMs; state.running = true; },
  adjust({ ms }) { if (!state.phase || !Number.isFinite(ms)) return;
    if (state.running) state.endsAt = Math.max(Date.now(), (ms > 0 ? Math.max(state.endsAt, Date.now()) : state.endsAt) + ms);
    else state.remainingMs = Math.max(0, state.remainingMs + ms);
    state.durationMs = Math.max(state.durationMs + ms, state.running ? state.endsAt - Date.now() : state.remainingMs); },
  end: clearClock,
  // the run sheet: each day's steps in order (content.json 'run'). A step starts a phase, sends an item, records the day's decision, or is a cue that is only ticked off.
  // A film cue also starts its film for observers: 'film' is the one film, 'films' the version for an earlier day's decision, 'pick' (or 'films' with no decision recorded) the one the game master tapped.
  step({ i, film }) { const run = day().run || [], s = run[i]; if (!s) return; if (s.phase) commands.start({ phase: s.phase }); else if (s.send) commands.send({ id: s.send, to: s.to });
    const options = s.pick || Object.values(s.films || {}), id = s.film || (s.films && s.films[state.decisions[s.by]]) || (options.includes(film) ? film : null);
    if (id) commands.film({ id }); state.step[state.day] = i + 1; },
  film({ id }) { if (filmList()[id]) state.film = { id, at: Date.now() }; },
  filmStop() { state.film = null; },
  // the room's decision for the day: picks which bulletin version and which follow-up items the later days show
  decide({ i, choice }) { const q = (day().questions || [])[0]; if (!q || !(q.opts || []).includes(choice)) return; state.decisions[state.day] = choice; if (Number.isInteger(i)) state.step[state.day] = i + 1; },
  undecide() { delete state.decisions[state.day]; },
  stepBack() { state.step[state.day] = Math.max(0, (state.step[state.day] || 0) - 1); },
  identify() { state.identifyUntil = Date.now() + 12000; },
  // briefing
  send({ id, to }) { const item = day().items.find((i) => i.id === id); if (!item) return; to = to || item.to || 'all';
    const key = `${state.day}:${id}:${to}`; if (!state.sent.some((s) => s.key === key)) state.sent.push({ key, day: state.day, id, to, at: Date.now() }); },
  recall({ key }) { state.sent = state.sent.filter((s) => s.key !== key); },
  note({ text, to }) { text = String(text || '').trim().slice(0, 600); if (text) state.sent.push({ key: `${state.day}:note:${Date.now()}`, day: state.day, note: text, to: to || 'all', at: Date.now() }); },
  // setup
  minutes({ phase, minutes }) { minutes = Math.round(+minutes * 2) / 2; if (content.phases.some((p) => p.id === phase) && minutes > 0 && minutes <= 180) S().minutes[phase] = minutes; },
  teamAdd({ name }) { name = clean(name); if (name && S().teams.length < 40) S().teams.push({ id: newId(name), name, roles: [] }); },
  teamRename({ id, name }) { const t = S().teams.find((x) => x.id === id); if (t && clean(name)) t.name = clean(name); },
  teamRemove({ id }) { S().teams = S().teams.filter((t) => t.id !== id); },
  roleAdd({ team, name }) { const t = S().teams.find((x) => x.id === team); name = clean(name); if (t && name && t.roles.length < 40) t.roles.push({ id: newId(name), name }); },
  roleRename({ id, name }) { const r = allRoles().find((x) => x.id === id); if (r && clean(name)) r.name = clean(name); },
  roleRemove({ id }) { for (const t of S().teams) t.roles = t.roles.filter((r) => r.id !== id); },
  joinCode({ code }) { S().joinCode = clean(code, 20); },
  setupDefaults() { const joinCode = S().joinCode; state.setup = { ...seedSetup(), joinCode }; },
  reset() { state = Object.assign(fresh(), { setup: state.setup }); },
};

// game master key, with a brake on guessing
const bad = new Map();
function keyOK(req, u) {
  if (!KEY) return true;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress, now = Date.now(), b = bad.get(ip);
  if (b && now - b.t < 60000 && b.n >= 8) return null;
  const k = String(req.headers['x-key'] || u.searchParams.get('key') || '');
  if (k.length === KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(KEY))) return true;
  bad.set(ip, b && now - b.t < 60000 ? { n: b.n + 1, t: b.t } : { n: 1, t: now }); return false;
}
const codeOK = (u) => !S().joinCode || (u.searchParams.get('code') || '').trim().toLowerCase() === S().joinCode.toLowerCase();

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const deny = (res, ok) => { res.writeHead(ok === null ? 429 : 403); res.end(); };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/events') {
    const control = u.searchParams.has('control'), watch = !control && u.searchParams.has('watch');
    if (control) { const ok = keyOK(req, u); if (!ok) return deny(res, ok); } else if (!watch && !codeOK(u)) return deny(res, false);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const c = { res, control, watch, team: u.searchParams.get('team'), role: u.searchParams.get('role') };
    clients.add(c); push(c); if (!control) broadcast();
    req.on('close', () => { clients.delete(c); broadcast(); });
    return;
  }
  if (u.pathname === '/seats') return codeOK(u) ? json(res, 200, { title: content.title, teams: S().teams }) : json(res, 403, { title: content.title, needCode: true });
  if (u.pathname === '/healthz') return json(res, 200, { ok: true, devices: clients.size });
  if (u.pathname === '/auth') { const ok = keyOK(req, u); if (!ok) return deny(res, ok); res.writeHead(204); return res.end(); }
  if (u.pathname === '/cmd' && req.method === 'POST') {
    const ok = keyOK(req, u); if (!ok) return deny(res, ok);
    let body = ''; req.on('data', (d) => { body += d; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => { try { const m = JSON.parse(body); if (Object.hasOwn(commands, m.type)) { commands[m.type](m); save(); broadcast(); } res.writeHead(204); } catch { res.writeHead(400); } res.end(); });
    return;
  }
  if (u.pathname === '/control' || (u.pathname === '/' && u.searchParams.has('team'))) { res.writeHead(302, { Location: (u.pathname === '/' ? '/play' : '/gm') + u.search }); return res.end(); }
  const page = { '/': '/index.html', '/play': '/table.html', '/gm': '/control.html', '/watch': '/watch.html' }[u.pathname] || u.pathname;
  const file = path.join(PUB, path.normalize(page));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.woff2' || ext === '.png' ? 'max-age=86400' : 'no-cache', 'X-Robots-Tag': 'noindex' });
    res.end(buf);
  });
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use: the timer is probably running already. Stop that one, or start this with PORT=2425.` : e.message); process.exit(1); });
server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\nAIGI table timer\n`);
  for (const h of ips.length ? ips : ['localhost']) console.log(`  Portal        http://${h}:${PORT}/\n  Participants  http://${h}:${PORT}/play\n  Game master   http://${h}:${PORT}/gm\n  Observers     http://${h}:${PORT}/watch\n`);
  console.log(KEY ? `  Game master key: ${KEY}\n` : `  No game master key set (AIGI_KEY). Anyone with the address can open /gm.\n`);
  save();
});
