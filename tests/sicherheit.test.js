// Test Version 2.3.1 (Sicherheit): manipulierte Sicherung (HTML und Skript in allen Textfeldern, falsche Typen, sehr lange Werte,
// falsche Dateitypen bei Fotos), Excel-Formeln beim Kopieren, Content-Security-Policy, Service Worker, exceljs, GitHub Actions
const {JSDOM, VirtualConsole} = require('jsdom'); const fs = require('fs'); const vm = require('vm'); const ExcelJS = require('exceljs');
const {IDBFactory} = require('fake-indexeddb');
const H = require('./helpers'); const CSP = require('./csp');
const html = fs.readFileSync(H.ROOT + '/index.html', 'utf8');
const excelSrc = fs.readFileSync(H.ROOT + '/exceljs.min.js', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
let store = {}, idb = null;
const saved = [], blobs = {}, errors = [];
// Jeder Fehler im Skript der App zählt, auch in asynchronen Abläufen
process.on('unhandledRejection', e => errors.push('Promise: ' + (e && e.message || e)));
function boot() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push(e.message + (e.detail ? ' ' + (e.detail.message || e.detail) : '')); });
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/', virtualConsole: vc,
    beforeParse(w) { H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k]}});
      Object.defineProperty(w, 'indexedDB', {value: idb, configurable: true});
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.scrollTo = () => {}; w.print = () => {}; w.eval(excelSrc);
      let n = 0;
      w.URL.createObjectURL = b => { const u = 'blob:x' + (++n); blobs[u] = b; return u; }; w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { saved.push({name: this.download, blob: blobs[this.href]}); };
      w.File.prototype.text = function () { return new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(this); }); };
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
const read = (w, blob) => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(Buffer.from(fr.result)); fr.readAsArrayBuffer(blob); });
const data = () => JSON.parse(store[KEY]);
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const idbOpen = () => new Promise((res, rej) => {
  const rq = idb.open(KEY + '-belege', 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore('files', {keyPath: 'id'});
  rq.onsuccess = () => res(rq.result); rq.onerror = rej;
});
// Alle Fotos in der Gerätedatenbank: Kennung → Dateityp und Größe
const idbAll = async () => { const db = await idbOpen(); return new Promise((res, rej) => {
  const g = db.transaction('files').objectStore('files').getAll();
  g.onsuccess = () => { db.close(); const m = {}; g.result.forEach(r => { m[r.id] = {type: r.type, size: r.buf ? r.buf.byteLength : 0}; }); res(m); }; g.onerror = rej;
}); };
const idbPut = async rec => { const db = await idbOpen(); return new Promise((res, rej) => {
  const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(rec); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = rej;
}); };

// HTML und Skript, wie sie jemand in eine Sicherungsdatei schreiben könnte
const P = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>"><svg onload="window.__pwned=3">\'&';
const long = 'A'.repeat(100000);
const bad = {toString: 1}; // wird zu {"toString":1}; daraus einen Text zu machen, wirft einen Fehler
const b64 = s => Buffer.from(s).toString('base64');
const evil = {app: 'sakra-schichtbuch', version: 4,
  settings: {name: P, employer: P, home: P + long, state: 'toString', veh: 'constructor', fixed: 'sammel', fixedName: P, fixedKm: 1e300, pause: -30,
    ausOn: true, ausFull: 1e300, ausHalf: bad, ausDay: '12,50', lodgingBy: 'hasOwnProperty', kmOn: true, kmGeld: [5], travelPaid: 'x', profSeen: true,
    nr20: {'2026': bad, '2025': 1200, abcd: 5, ['__proto__']: 7}, shifts: {frueh: ['<b>', 'x'], tag: 'nope', spaet: [bad, 5], nacht: ['21:30', '05:30']}},
  entries: [
    {id: 'h1', date: '2026-10-12', type: 'arbeit', shift: 'tag', start: '07:00', end: '15:30', pause: 30, place: P, line: '=1+1', project: P, away: 'an',
      depart: '05:00', lodging: 80, lodgingName: P, vehicle: 'pkw', trip: 'dienst', meet: '@SUM(1)', km: 50, allowance: 20, otherCost: 5, otherNote: '-2+3', note: P + long,
      meals: {b: true}, photos: ['ph-html', 'ph-svg', 'ph-param', 'ph-big', 'ph-bad64', 'ph-jpg'], updated: '2026-10-12T18:00:00Z'},
    {id: 'h2"><b>x</b>', date: '2026-10-11', type: 'arbeit', place: P, note: P},
    {id: 'h3', date: '2026-10-09', type: 'constructor', shift: 'toString', away: '__proto__', vehicle: 'hasOwnProperty', trip: bad, place: bad, line: ['a', 'b'], project: 12345,
      lodgingName: true, meet: null, note: bad, km: '1e308', lodging: 1e308, allowance: -50, otherCost: 'abc', pause: 99999, travelMin: 1e9, start: bad, end: '07:00',
      depart: [1], ret: 5, meals: 'xyz', photos: 'nope', updated: bad},
    {id: '__proto__', date: '2026-10-08', type: 'arbeit', place: 'Proto'},
    {id: bad, date: '2026-10-07', type: 'arbeit', place: 'Kennung kaputt'},
    {id: 'h4', date: bad, place: 'Datum kaputt'},
    'Text statt Eintrag', 42, null, [], true
  ],
  expenses: [
    {id: 'x1', date: '2026-10-05', amount: 12.5, cat: 'constructor', text: P, note: P, photos: ['ph-pdf']},
    {id: 'x2', date: '2026-10-06', amount: bad, cat: '__proto__', text: bad, note: long},
    {id: 'x3', date: '2026-10-04', amount: 20, cat: 'kleidung', text: '=HYPERLINK("https://example.invalid/?"&A1;"Klick")', note: '+49 170 1234567'},
    null, 'x'
  ],
  files: [
    {id: 'ph-html', type: 'text/html', name: P, data: b64('<script>window.__pwned=4</script>')},
    {id: 'ph-svg', type: 'image/svg+xml', name: 'x.svg', data: b64('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=5"/>')},
    {id: 'ph-param', type: 'image/svg+xml;charset=utf-8', name: 'y.svg', data: b64('<svg xmlns="http://www.w3.org/2000/svg"/>')},
    {id: 'ph-big', type: 'image/jpeg', name: 'gross.jpg', data: 'A'.repeat(20000004)},
    {id: 'ph-bad64', type: 'image/jpeg', name: 'kaputt.jpg', data: '***kein base64***'},
    {id: 'ph-jpg', type: 'image/jpeg', name: 'quittung.jpg', data: b64('\xff\xd8\xff\xe0JPEG')},
    {id: 'ph-pdf', type: 'application/pdf', name: P, data: b64('%PDF-1.4 test')},
    {id: 'ph-orphan', type: 'image/jpeg', name: 'waise.jpg', data: b64('JPEG')},
    {id: '../../etc', type: 'image/jpeg', data: b64('x')}, {id: 5, data: b64('x')}, {id: 'ph-nodata', data: 7}, null, 'x'
  ]};
const evilJson = JSON.stringify(evil);

(async () => {
  let dom, w, d, $;
  const start = async () => { if (dom) dom.window.close(); dom = boot(); w = dom.window; d = w.document; $ = s => d.querySelector(s); await wait(60); };
  const click = (attr, val) => { const b = d.createElement('button'); b.setAttribute(attr, val); $('#v-list').appendChild(b); b.click(); b.remove(); };
  // Nach jeder Ansicht: kein Skript ausgeführt, kein Element mit on…-Attribut, keine eingeschleusten Bilder oder Skripte
  const injected = () => {
    const on = [...d.querySelectorAll('*')].filter(el => [...el.attributes].some(a => /^on/i.test(a.name)));
    return (w.__pwned ? ['ausgeführt ' + w.__pwned] : []).concat(on.map(el => el.tagName + ' mit on…'),
      d.querySelectorAll('script').length !== 2 ? ['Skripte: ' + d.querySelectorAll('script').length] : [], d.querySelector('img[src="x"]') ? ['img src=x'] : []);
  };
  const viewOk = (name, sel) => { const bad = injected(); check(name + ': nichts ausgeführt, Text als Text', !bad.length && (!sel || T($(sel).textContent).includes('<img src=x onerror')), bad.join(', ')); };

  // ---------- A: Manipulierte Sicherung laden ----------
  idb = new IDBFactory();
  // vorhandener Tag mit einem Foto im alten Dateityp (so könnte es aus einer früheren Version stammen)
  store = {}; store[KEY] = JSON.stringify({version: 4, lastBackup: H.nowIso(), seenVersion: '2.3.1',
    entries: {lokal1: {id: 'lokal1', date: '2026-10-02', year: 2026, type: 'arbeit', place: 'Soest', photos: ['ph-alt'], updated: '2026-10-02T10:00:00Z'}}, expenses: {},
    settings: {profSeen: true, state: 'NW'}});
  await idbPut({id: 'ph-alt', type: 'image/svg+xml', name: 'alt.svg', buf: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=6"/>').buffer});
  await start();
  $('[data-view="more"]').click();
  const fi = $('#x-restore'), file = new w.File([evilJson], 'Sicherung.json', {type: 'application/json'});
  Object.defineProperty(fi, 'files', {value: [file], configurable: true}); fi.dispatchEvent(new w.Event('change')); await wait(800);
  check('Sicherung geladen, App läuft weiter', T($('#b-status').textContent) === '5 Arbeitstage und 3 Ausgaben mit 5 Belegfotos aus der Sicherung übernommen.' && !errors.length,
    T($('#b-status').textContent) + ' | ' + errors.slice(0, 3).join(' / '));
  const st = data(), ents = Object.values(st.entries), exps = Object.values(st.expenses);
  const okKey = (m, k) => k === m[k].id && /^[A-Za-z0-9][A-Za-z0-9_~:@+-]{0,99}$/.test(k);
  check('Gespeichert: 6 Tage (mit dem vorhandenen) und 3 Ausgaben', ents.length === 6 && exps.length === 3, ents.length + '/' + exps.length);
  check('Kennungen sauber und gleich dem Schlüssel', Object.keys(st.entries).every(k => okKey(st.entries, k)) && Object.keys(st.expenses).every(k => okKey(st.expenses, k)) && !st.entries.h4,
    Object.keys(st.entries).join(','));
  const TXT = ['place', 'line', 'project', 'lodgingName', 'meet', 'otherNote'];
  check('Texte sind Texte und begrenzt', ents.every(e => TXT.every(k => typeof e[k] === 'string' && e[k].length <= 200) && typeof e.note === 'string' && e.note.length <= 1000 && typeof e.updated === 'string')
    && exps.every(x => typeof x.text === 'string' && x.text.length <= 200 && x.note.length <= 1000));
  const h3 = st.entries.h3 || {};
  check('Falsche Typen werden leer statt „[object Object]“', h3.place === '' && h3.line === '' && h3.project === '12345' && h3.lodgingName === '' && h3.note === '' && h3.start === '' && h3.depart === '' && h3.ret === '',
    JSON.stringify([h3.place, h3.line, h3.project, h3.lodgingName, h3.start]));
  check('Auswahlwerte nur aus der Liste (kein „constructor“)', ents.every(e => ['arbeit', 'anreise', 'abreise', 'schulung', 'frei', 'urlaub', 'krank'].includes(e.type) && ['', 'frueh', 'tag', 'spaet', 'nacht', 'ausfall'].includes(e.shift)
    && ['none', 'tag', 'an', 'voll', 'ab'].includes(e.away) && ['', 'pkw', 'firma', 'mit', 'oepnv'].includes(e.vehicle) && ['dienst', 'sammel'].includes(e.trip))
    && exps.every(x => ['kleidung', 'mittel', 'bildung', 'gew', 'fahrt', 'sonst'].includes(x.cat)), JSON.stringify([h3.type, h3.shift, h3.away, h3.vehicle, (st.expenses.x1 || {}).cat]));
  const NUM = ['pause', 'lodging', 'km', 'allowance', 'otherCost', 'travelMin'];
  check('Zahlen endlich und begrenzt', ents.every(e => NUM.every(k => Number.isFinite(e[k]) && e[k] >= 0 && e[k] <= 1e6) && e.pause <= 1440 && e.travelMin <= 1440)
    && exps.every(x => Number.isFinite(x.amount) && x.amount >= 0 && x.amount <= 1e6), JSON.stringify(NUM.map(k => h3[k])));
  check('Zeiten nur als hh:mm', ents.every(e => ['start', 'end', 'depart', 'ret'].every(k => e[k] === '' || /^\d{1,2}:\d{2}$/.test(e[k]))));
  const s = st.settings;
  check('Einstellungen: Auswahl nur aus der Liste', s.state === '' && s.veh === '' && s.lodgingBy === 'self' && s.fixed === 'sammel', JSON.stringify([s.state, s.veh, s.lodgingBy]));
  check('Einstellungen: Texte und Zahlen begrenzt', s.name.length <= 200 && s.home.length <= 200 && s.pause === 0 && s.fixedKm <= 1e6 && s.ausFull <= 1e6 && s.ausHalf === 0 && s.ausDay === 12.5 && s.kmGeld === 0,
    JSON.stringify([s.pause, s.fixedKm, s.ausFull, s.ausHalf, s.ausDay, s.kmGeld]));
  check('Einstellungen: Nr. 20 nur mit Jahr und Zahl', JSON.stringify(s.nr20) === '{"2025":1200}', JSON.stringify(s.nr20));
  check('Einstellungen: Schichtzeiten nur als hh:mm', s.shifts.frueh.join() === '05:00,13:30' && s.shifts.tag.join() === '07:00,15:30' && s.shifts.spaet.join() === '13:30,22:00' && s.shifts.nacht.join() === '21:30,05:30',
    JSON.stringify(s.shifts));
  // Belegfotos: nur sichere Dateitypen, nichts Übergroßes, nur was ein Eintrag braucht
  const recs = await idbAll();
  check('Fotos: Webseite und SVG nur noch als Datei, nicht als Bild oder Seite', recs['ph-html'] && recs['ph-html'].type === 'application/octet-stream' && recs['ph-svg'].type === 'application/octet-stream'
    && recs['ph-param'].type === 'application/octet-stream', JSON.stringify(recs['ph-html']));
  check('Fotos: JPEG und PDF bleiben, wie sie sind', recs['ph-jpg'] && recs['ph-jpg'].type === 'image/jpeg' && recs['ph-pdf'] && recs['ph-pdf'].type === 'application/pdf');
  check('Fotos: zu groß, kaputt, ohne Bezug oder mit falscher Kennung bleiben draußen', !recs['ph-big'] && !recs['ph-bad64'] && !recs['ph-orphan'] && !recs['../../etc'] && !recs['5'] && !recs['ph-nodata'],
    Object.keys(recs).join(','));

  // ---------- B: Alle Ansichten mit den manipulierten Daten ----------
  $('[data-view="list"]').click(); viewOk('Startseite', '#v-list');
  $('[data-view="cal"]').click(); $('[data-cal-day="2026-10-12"]').click(); viewOk('Kalender', '#v-cal');
  click('data-day', '2026-10-12'); viewOk('Tagesdetail', '#v-day');
  $('[data-view="all"][data-listmode="days"]').click(); viewOk('Alle Arbeitstage', '#v-all');
  $('[data-mode="exp"]').click(); viewOk('Alle Ausgaben', '#v-all');
  $('[data-view="stats"]').click(); viewOk('Auswertung', '#stats-body');
  $('[data-stab="tax"]').click(); viewOk('Steuer mit Anlage N', '#stats-body');
  $('[data-stab="work"]').click(); viewOk('Arbeit mit Monat und Einsatzorten', '#stats-body');
  $('#nav-settings').click(); await wait(20);
  check('Einstellungen: Text steht unverändert im Feld', $('#s-name').value === P && $('#p-fixed-name').value === P && $('#s-pause').value === '0', $('#s-name').value.slice(0, 30));
  viewOk('Einstellungen');
  $('[data-view="more"]').click(); $('#x-report').click(); await wait(50);
  $('#r-photos').checked = true; $('#r-photos').dispatchEvent(new w.Event('change')); await wait(300);
  viewOk('Jahresbericht', '#r-paper');
  check('Jahresbericht: Belege als Bilder, PDF als Hinweis', d.querySelectorAll('#r-belege .beleg img').length === 5 && T($('#r-belege').textContent).includes('PDF-Beleg „<img src=x'),
    d.querySelectorAll('#r-belege .beleg').length);
  w.dispatchEvent(new w.PopStateEvent('popstate', {state: null})); await wait(10);
  $('[data-bell]').click(); viewOk('Glocke'); $('[data-bell-close]').click();
  // Formular mit den Fotos: Vorschau und großes Bild
  click('data-id', 'h1'); await wait(150);
  check('Formular: Text im Feld, Vorschau ohne Skript', $('#f-place').value === P && d.querySelectorAll('#f-thumbs .thumb').length === 6 && !injected().length, injected().join(', '));
  const types = () => Object.values(blobs).map(b => b.type), risky = t => /text\/html|image\/svg/.test(t);
  check('Vorschau: Bilder nie als Webseite oder SVG', types().length && !types().some(risky), [...new Set(types())].join(', '));
  $('#f-thumbs [data-photo="ph-svg"]').click(); await wait(50);
  check('Großes Bild: SVG nur als Datei, ohne Skript', !$('#viewer').hidden && !!$('#v-body img') && !injected().length && !types().some(risky));
  $('#v-close').click();
  $('#f-save').click(); await wait(80);
  check('Tag mit den Daten speichern geht', !errors.length && T($('#toast').textContent) === 'Gespeichert', errors.slice(0, 2).join(' / '));
  // Foto aus einer früheren Version mit SVG-Typ: wird als Datei gezeigt, nicht als SVG
  click('data-id', 'lokal1'); await wait(150);
  $('#f-thumbs [data-photo="ph-alt"]').click(); await wait(50);
  check('Altes Foto mit SVG-Typ: nur als Datei, ohne Skript', !!$('#v-body img') && !types().some(risky) && !injected().length);
  $('#v-close').click(); $('#f-back').click(); await wait(20);
  // Neues Foto: SVG und andere Dateien werden übersprungen
  $('[data-view="all"][data-listmode="exp"]').click(); d.querySelector('[data-newexp]').click();
  const fp = $('#p-photo-in'); Object.defineProperty(fp, 'files', {value: [new w.File(['<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=7"/>'], 'beleg.svg', {type: 'image/svg+xml'})], configurable: true});
  fp.dispatchEvent(new w.Event('change')); await wait(100);
  check('SVG als Beleg wird übersprungen', !d.querySelectorAll('#p-thumbs .thumb').length && T($('#toast').textContent).includes('übersprungen'), T($('#toast').textContent));
  $('#p-back').click(); await wait(20);

  // ---------- C: Excel-Datei und Tabelle kopieren ----------
  $('[data-view="more"]').click();
  $('#x-xlsx').click(); await wait(1500);
  const xf = saved.find(f => f.name.endsWith('.xlsx'));
  const wb = new ExcelJS.Workbook(); if (xf) await wb.xlsx.load(await read(w, xf.blob));
  const ws = wb.getWorksheet('Einträge'), xs = wb.getWorksheet('Ausgaben');
  const cells = []; wb.eachSheet(sh => sh.eachRow(r => r.eachCell(c => cells.push(c.value))));
  check('Excel: Datei entsteht trotz manipulierter Daten', !!xf && !!ws && !!xs && !errors.length);
  check('Excel: Texte mit = bleiben Text', cells.includes('=1+1') && cells.includes('=HYPERLINK("https://example.invalid/?"&A1;"Klick")') && cells.includes(P));
  check('Excel: Formeln nur die eigenen Summen', cells.filter(v => v && typeof v === 'object' && v.formula).every(v => /^SUM\([A-Z]+\d+:[A-Z]+\d+\)$/.test(v.formula)));
  $('#x-copy').click(); await wait(50);
  const row = ($('#x-tsv').value.split('\n').find(l => l.startsWith('12.10.2026')) || '').split('\t');
  check('Kopieren: Texte mit = + - @ vorne bekommen ein Hochkomma', row.includes("'=1+1") && row.includes("'@SUM(1)") && row.includes("'-2+3") && !row.includes('=1+1'), row.filter(c => /^'?[=+@-]/.test(c)).join(' | '));
  check('Kopieren: Zahlen und Uhrzeiten unverändert', row.includes('07:00') && row.includes('15:30') && row.includes('50'), row.slice(0, 8).join(' | '));

  // ---------- D: Neustart mit den gespeicherten Daten ----------
  await start();
  check('Neustart: App startet ohne Fehler', !errors.length && !$('#v-list').hidden && !injected().length, errors.slice(0, 2).join(' / '));
  // Auch ungewöhnliche Daten im Gerätespeicher (z. B. von Hand bearbeitet) bringen den Start nicht zum Absturz
  store = {}; store[KEY] = JSON.stringify({version: 4, entries: {a1: {id: 'a1', date: '2026-10-01', type: 'toString', place: bad, note: bad, km: bad}, a2: {id: bad, date: '2026-10-02'}, a3: 'x'},
    expenses: {b1: {id: 'b1', date: '2026-10-01', amount: bad, cat: 'valueOf', text: bad}}, settings: {name: bad, state: 'constructor', pause: bad, shifts: bad, nr20: bad, profSeen: true}});
  await start();
  check('Ungewöhnliche Daten im Gerätespeicher: Start ohne Fehler', !errors.length && T($('#v-list').textContent).includes('Letzte Einträge'), errors.slice(0, 2).join(' / '));

  // ---------- E: Content-Security-Policy ----------
  const p = CSP.policy(html) || {};
  const has = (k, ...v) => Array.isArray(p[k]) && v.every(x => p[k].includes(x));
  const at = s => html.indexOf(s);
  check('CSP steht im Kopf vor Stil und Skripten', at('http-equiv="Content-Security-Policy"') > at('<meta charset') && at('http-equiv="Content-Security-Policy"') < at('<script') && at('http-equiv="Content-Security-Policy"') < at('<style'));
  check('CSP: Grundregeln', has('default-src', "'self'") && has('connect-src', "'self'") && has('img-src', "'self'", 'blob:', 'data:') && has('object-src', "'none'") && has('base-uri', "'none'")
    && has('form-action', "'none'") && has('frame-src', "'none'") && has('worker-src', "'self'"), JSON.stringify(p).slice(0, 120));
  check('CSP: Skripte nur von hier und mit Prüfsumme (kein unsafe-inline, kein eval)', has('script-src', "'self'") && p['script-src'].every(x => x === "'self'" || /^'sha256-[A-Za-z0-9+/]+=*'$/.test(x)));
  check('CSP: Prüfsummen passen zu den Skripten', JSON.stringify(p['script-src'].filter(x => x.startsWith("'sha256-")).sort()) === JSON.stringify(CSP.hashes(html).sort()),
    'Skript geändert? „npm run csp“ trägt die Prüfsummen neu ein.');
  check('CSP: keine fremden Server', !Object.values(p).some(v => v.some(x => /^https?:|^\*|^'unsafe-eval'$/.test(x))));
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  check('Keine on…-Attribute und keine javascript:-Links (die CSP würde sie blockieren)', !/<[a-z][^>]*\son[a-z]+\s*=/i.test(markup) && !/javascript:/i.test(html) && !/\son[a-z]+=["'$]/.test(CSP.inlineScripts(html).join('\n')));

  // ---------- F: Service Worker speichert nur die App als Startseite ----------
  const puts = [], on = {};
  const ctx = {URL, self: {addEventListener: (t, f) => { on[t] = f; }, location: {origin: 'https://example.org'}, clients: {claim: () => {}}, skipWaiting: () => {}},
    caches: {open: async () => ({match: async () => ({alt: true}), put: async k => { puts.push(typeof k === 'string' ? k : k.url); }}), keys: async () => [], delete: async () => true},
    fetch: async req => ({ok: true, type: 'basic', url: req.url, clone() { return this; }}), Response: class { constructor(b, o) { this.body = b; this.status = o && o.status; } }};
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(H.ROOT + '/sw.js', 'utf8'), ctx);
  const nav = async url => { puts.length = 0; let r = null; const wt = []; on.fetch({request: {method: 'GET', url, mode: 'navigate'}, respondWith: x => { r = x; }, waitUntil: x => wt.push(x)}); await r; await Promise.all(wt); return puts.slice(); };
  check('Service Worker: Start der App frischt die gespeicherte App auf', (await nav('https://example.org/schichtbuch/')).includes('./index.html') && (await nav('https://example.org/schichtbuch/index.html?x=1')).includes('./index.html'));
  check('Service Worker: andere Seite (z. B. LIESMICH.txt) ersetzt nicht die App', !(await nav('https://example.org/schichtbuch/LIESMICH.txt')).includes('./index.html'));

  // ---------- G: exceljs und GitHub Actions ----------
  const lock = JSON.parse(fs.readFileSync(H.ROOT + '/package-lock.json', 'utf8')).packages['node_modules/exceljs'];
  check('exceljs.min.js ist unverändert das offizielle Paket 4.4.0', lock.version === '4.4.0' && /^https:\/\/registry\.npmjs\.org\//.test(lock.resolved)
    && Buffer.compare(fs.readFileSync(H.ROOT + '/exceljs.min.js'), fs.readFileSync(H.ROOT + '/node_modules/exceljs/dist/exceljs.min.js')) === 0);
  const wf = fs.readFileSync(H.ROOT + '/.github/workflows/pruefen.yml', 'utf8');
  const uses = wf.match(/uses:\s*\S+/g) || [];
  check('Actions auf feste Commits gepinnt', uses.length === 5 &&uses.every(u => /@[0-9a-f]{40}$/.test(u)), uses.filter(u => !/@[0-9a-f]{40}$/.test(u)).join(' '));
  check('Workflow: knappe Rechte, kein gespeichertes Token, keine Installationsskripte', /^permissions:\s*\n\s+contents: read/m.test(wf) && (wf.match(/persist-credentials: false/g) || []).length === 2
    && /npm ci --ignore-scripts/.test(wf) && !/npm ci\s*$/m.test(wf));

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
