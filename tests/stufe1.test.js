// Test Version 1.4.0 (Stufe 1): Was ist neu, 24 Std. auswärts, kürzeres Formular, Zuschlagsstunden, Nr. 20, Jahresbericht, Belegfotos
const {JSDOM} = require('jsdom'); const fs = require('fs'); const ExcelJS = require('exceljs');
const {IDBFactory} = require('fake-indexeddb');
const H = require('./helpers');
const DIR = H.ROOT + '/';
const html = fs.readFileSync(DIR + 'index.html', 'utf8');
const excelSrc = fs.readFileSync(DIR + 'exceljs.min.js', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
let store = {}, idb = null, printed = 0;
const saved = [];
function boot(withIdb) {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) { H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k]}});
      if (withIdb) Object.defineProperty(w, 'indexedDB', {value: idb, configurable: true});
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.scrollTo = () => {}; w.print = () => { printed++; }; w.eval(excelSrc);
      const blobs = {}; let n = 0;
      w.URL.createObjectURL = b => { const u = 'blob:x' + (++n); blobs[u] = b; return u; }; w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { saved.push({name: this.download, blob: blobs[this.href]}); };
      w.File.prototype.text = function () { return new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(this); }); };
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
const read = (w, blob) => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(Buffer.from(fr.result)); fr.readAsArrayBuffer(blob); });
const inp = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', {bubbles: true})); el.dispatchEvent(new w.Event('change', {bubbles: true})); };
const data = () => JSON.parse(store[KEY]);
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const E = (id, date, o) => Object.assign({id, date, year: +date.slice(0, 4), type: 'arbeit', shift: '', start: '', end: '', pause: 0, travelMin: 0, place: '', line: '', project: '', away: 'none',
  depart: '', ret: '', meals: {}, lodging: 0, lodgingName: '', vehicle: '', trip: 'dienst', meet: '', km: 0, allowance: 0, otherCost: 0, otherNote: '', note: '', updated: '2026-01-01T00:00:00Z'}, o);
const X = (id, date, o) => Object.assign({id, date, year: +date.slice(0, 4), amount: 0, cat: 'sonst', text: '', note: '', updated: '2026-01-01T00:00:00Z'}, o);
const seed = (entries, settings, extra) => {
  store = {}; const m = {}; entries.forEach(e => m[e.id] = e);
  const x = {}; ((extra && extra.expenses) || []).forEach(e => x[e.id] = e);
  store[KEY] = JSON.stringify(Object.assign({version: 4, entries: m, expenses: x, lastBackup: H.nowIso(), seenVersion: '1.4.0',
    settings: Object.assign({ausFull: 0, ausHalf: 0, profSeen: true}, settings || {})}, extra && extra.top || {}));
};
// Kennungen in der Fotodatenbank (direkt, ohne App)
const idbKeys = () => new Promise((res, rej) => {
  const rq = idb.open(KEY + '-belege', 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore('files', {keyPath: 'id'});
  rq.onsuccess = () => { const db = rq.result, g = db.transaction('files').objectStore('files').getAllKeys(); g.onsuccess = () => { db.close(); res(g.result); }; g.onerror = rej; };
  rq.onerror = rej;
});
const idbPut = rec => new Promise((res, rej) => {
  const rq = idb.open(KEY + '-belege', 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore('files', {keyPath: 'id'});
  rq.onsuccess = () => { const db = rq.result, tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(rec); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = rej; };
});

(async () => {
  let dom, w, d, $;
  const start = async withIdb => { if (dom) dom.window.close(); dom = boot(withIdb); w = dom.window; d = w.document; $ = s => d.querySelector(s); await wait(60); };
  const openNew = date => { const b = d.createElement('button'); b.dataset.new = date; $('#v-list').appendChild(b); b.click(); b.remove(); };
  const openId = id => { const b = d.createElement('button'); b.dataset.id = id; $('#v-list').appendChild(b); b.click(); b.remove(); };
  const view = () => ['list','cal','day','all','stats','more','report','form','exp'].filter(k => !$('#v-' + k).hidden).join(',');
  const pressed = g => [...d.querySelectorAll(g + ' [aria-pressed="true"]')].map(b => b.dataset.v).join(',');

  // ---------- A: Was ist neu ----------
  store = {};
  await start();
  check('Neuer Nutzer: kein „Was ist neu“', !$('.news'));
  $('[data-view="more"]').click();
  check('Über die App: Liste aller Versionen', T($('#about-log').textContent).includes('Version 1.4.0') && T($('#about-log').textContent).includes('Version 1.2.0'), T($('#about-log').textContent).slice(0, 60));

  // Stand aus Version 1.3 (ohne seenVersion): nur die Neuigkeiten von 1.4.0
  seed([E('a1', '2026-10-12', {shift: 'frueh', start: '05:00', end: '13:30', pause: 30})], {}, {top: {seenVersion: undefined}});
  await start();
  const news = $('.news');
  check('Nach Update: Hinweis „Neu in Version 2.3.0“ mit 2.2.0, 2.1.0, 2.0.0 und 1.4.0', news && T(news.querySelector('b').textContent) === 'Neu in Version 2.3.0' && T(news.textContent).includes('Gleis') && T(news.textContent).includes('MontageBuch') && T(news.textContent).includes('Belegfotos') && !T(news.textContent).includes('„Deine Arbeit“'), news && T(news.textContent).slice(0, 80));
  news.querySelector('[data-news]').click(); await wait(10);
  check('Verstanden: weg und gemerkt (aktuelle Version)', !$('.news') && data().seenVersion === html.match(/APP_VERSION = '([^']+)'/)[1], data().seenVersion);
  await start();
  check('Nach Neustart bleibt er weg', !$('.news'));
  // Wer von 1.2 kommt, sieht alles seitdem
  seed([E('a1', '2026-10-12', {shift: 'frueh', start: '05:00', end: '13:30'})], {}, {top: {seenVersion: '1.2.0'}});
  await start();
  check('Von 1.2.0: auch 1.3.0 und 1.3.1', T($('.news').textContent).includes('„Deine Arbeit“') && T($('.news').textContent).includes('Gesetzliche Werte'), '');

  // ---------- B: Formular ----------
  seed([E('p1', '2026-10-16', {shift: 'tag', start: '07:00', end: '15:30', pause: 30, place: 'Hamm', project: 'Gleiserneuerung'})]);
  await start();
  openNew('2026-10-20');
  check('Knopf heißt „24 Std. auswärts“', T($('#g-away [data-v="voll"]').textContent) === '24 Std. auswärts');
  check('Vorlage mit Auftrag: Strecke und Auftrag aufgeklappt', $('#d-place').open && $('#f-project').value === 'Gleiserneuerung');
  check('Notiz eingeklappt', !$('#d-note').open);
  $('#g-away [data-v="voll"]').click();
  check('24 Std. ohne Anreise am Vortag: Hinweis', !$('#h-prev').hidden && T($('#h-prev').textContent).startsWith('Am Mo 19.10. ist keine Anreise eingetragen.'), T($('#h-prev').textContent));
  check('Hinweis Pauschale 28 €', T($('#h-away').textContent).includes('von 0 bis 24 Uhr') && T($('#h-away').textContent).includes('28 €'), T($('#h-away').textContent));
  $('#g-away [data-v="ab"]').click();
  check('Abreise ohne Vortag: Hinweis', !$('#h-prev').hidden && T($('#h-prev').textContent).includes('Abreise heißt'), T($('#h-prev').textContent));
  $('#g-away [data-v="an"]').click();
  check('Anreise: kein Hinweis', $('#h-prev').hidden);
  $('#f-clear').click();
  check('Leere Felder: Strecke und Auftrag eingeklappt', !$('#d-place').open);
  inp(w, $('#f-date'), '2026-10-17'); $('#g-away [data-v="voll"]').click();
  check('Vortag hat keine Anreise (nur Arbeit): Hinweis', !$('#h-prev').hidden);
  // Vortag mit Anreise
  seed([E('m1', '2026-10-18', {type: 'anreise', away: 'an', depart: '14:00'}), E('m2', '2026-10-19', {shift: 'tag', start: '07:00', end: '15:30', away: 'voll', note: 'Bauzug spät'})]);
  await start();
  openId('m2');
  check('24 Std. nach Anreise: kein Hinweis', $('#h-prev').hidden && pressed('#g-away') === 'voll');
  check('Notiz vorhanden: aufgeklappt', $('#d-note').open && $('#f-note').value === 'Bauzug spät');

  // ---------- C: Zuschlagsstunden (§ 3b EStG) ----------
  seed([
    E('z1', '2026-10-10', {shift: 'nacht', start: '22:00', end: '06:00'}),               // Sa auf So: 4 h Nacht 25 %, 4 h 40 %, 6 h Sonntag
    E('z2', '2026-10-11', {shift: 'nacht', start: '22:00', end: '06:00'}),               // So auf Mo: 4 h 25 %, 4 h 40 %, Sonntag 2 h + 4 h (Mo 0–4)
    E('z3', '2026-12-24', {shift: 'tag', start: '12:00', end: '20:00'}),                 // Heiligabend ab 14 Uhr: 6 h 150 %
    E('z4', '2026-12-31', {shift: 'nacht', start: '22:00', end: '06:00'}),               // Silvester 2 h + Neujahr 6 h = 8 h 125 %
    E('z5', '2026-05-01', {shift: 'tag', start: '07:00', end: '15:30', pause: 30}),      // 1. Mai: 8 h 150 %
    E('z6', '2026-06-04', {shift: 'tag', start: '07:00', end: '15:30', pause: 30}),      // Fronleichnam NRW: 8 h 125 %
    E('z7', '2026-10-18', {shift: 'ausfall', start: '22:00', end: '06:00'}),             // Ausfallschicht: zählt nicht
    E('z8', '2026-10-14', {shift: 'nacht', start: '22:00', end: '06:00', pause: 30})     // Pause anteilig: je 3,75 h
  ], {state: 'NW'});
  await start();
  $('[data-view="stats"]').click();
  const zc = [...d.querySelectorAll('#v-stats .card')].find(c => c.querySelector('h3') && c.querySelector('h3').textContent === 'Zuschlagsstunden');
  const zt = zc ? T(zc.textContent) : '';
  check('Auswertung: Karte Zuschlagsstunden', !!zc, '');
  check('Nacht 25 %: 15,75 h', zt.includes('Nacht 20 bis 6 Uhr bis 25 %15,75 h'), zt.slice(0, 200));
  check('Nacht 40 %: 15,75 h', zt.includes('Beginn vor Mitternacht bis 40 %15,75 h'));
  check('Sonntag 50 %: 12 h', zt.includes('Sonntag bis 50 %12 h'));
  check('Feiertag 125 %: 16 h', zt.includes('Silvester ab 14 Uhr bis 125 %16 h'));
  check('150 %: 14 h', zt.includes('1. Mai bis 150 %14 h'));
  $('[data-view="more"]').click(); $('#x-xlsx').click(); await wait(1500);
  let x = saved.filter(s => s.name.endsWith('.xlsx')).pop();
  let wb = new ExcelJS.Workbook(); await wb.xlsx.load(await read(w, x.blob));
  const en = wb.getWorksheet('Einträge'), eh = en.getRow(1).values.slice(1);
  const rowOf = date => { let r = null; en.eachRow((row, i) => { if (i > 1 && row.getCell(1).value instanceof Date && row.getCell(1).value.toISOString().slice(0, 10) === date) r = row; }); return r; };
  const zv = (date, col) => { const r = rowOf(date); return r ? r.getCell(eh.indexOf(col) + 1).value : 'keine Zeile'; };
  check('Excel Einträge: So-Nacht 6 h Sonntag', zv('2026-10-11', 'Sonntag 50 % (Std.)') === 6 && zv('2026-10-11', 'Nacht 40 % (Std.)') === 4, JSON.stringify([zv('2026-10-11', 'Sonntag 50 % (Std.)'), zv('2026-10-11', 'Nacht 40 % (Std.)')]));
  check('Excel Einträge: Silvester 8 h 125 %', zv('2026-12-31', 'Feiertag 125 % (Std.)') === 8);
  check('Excel Einträge: Ausfall leer', zv('2026-10-18', 'Sonntag 50 % (Std.)') === null, zv('2026-10-18', 'Sonntag 50 % (Std.)'));
  let sumRow = null; en.eachRow(r => { if (r.getCell(1).value === 'Summe') sumRow = r; });
  const sf = sumRow && sumRow.getCell(eh.indexOf('Feiertag 150 % (Std.)') + 1).value;
  check('Excel Einträge: Summe 150 %', sf && sf.result === 14 && /^SUM\(/.test(sf.formula), JSON.stringify(sf));
  const mo = wb.getWorksheet('Monate'), mh = mo.getRow(1).values.slice(1);
  check('Excel Monate: Oktober Sonntag 12 h', mo.getRow(11).getCell(mh.indexOf('Sonntag 50 % (Std.)') + 1).value === 12 && mh.indexOf('Auslöse / Spesen vom AG (€)') === 18, '');
  const ov = {}; wb.getWorksheet('Übersicht').eachRow(r => { const k = r.getCell(1).value; if (k) ov[String(k.richText ? k.richText.map(t => t.text).join('') : k)] = r.getCell(2).value; });
  check('Excel Übersicht: Zuschlagsstunden', ov['Sonntag (bis 50 %)'] === 12 && ov['Nacht 20 bis 6 Uhr (bis 25 %)'] === 15.75, JSON.stringify([ov['Sonntag (bis 50 %)'], ov['Nacht 20 bis 6 Uhr (bis 25 %)']]));
  // Brandenburg: Ostersonntag ist gesetzlicher Feiertag (125 % statt 50 %)
  seed([E('o1', '2026-04-05', {shift: 'tag', start: '07:00', end: '15:00'})], {state: 'BB'});
  await start(); $('[data-view="stats"]').click();
  check('Brandenburg: Ostersonntag 125 %', T($('#v-stats').textContent).includes('Silvester ab 14 Uhr bis 125 %8 h') && !T($('#v-stats').textContent).includes('Sonntag bis 50 %'), '');
  seed([E('o1', '2026-04-05', {shift: 'tag', start: '07:00', end: '15:00'})], {state: 'NW'});
  await start(); $('[data-view="stats"]').click();
  check('NRW: Ostersonntag nur Sonntag 50 %', T($('#v-stats').textContent).includes('Sonntag bis 50 %8 h'));

  // ---------- D: Nr. 20 der Lohnsteuerbescheinigung ----------
  seed([
    E('n1', '2026-09-07', {type: 'anreise', away: 'an', depart: '12:00', allowance: 21}),
    E('n2', '2026-09-08', {shift: 'tag', start: '07:00', end: '15:30', pause: 30, away: 'voll', allowance: 42}),
    E('n3', '2026-09-09', {shift: 'tag', start: '07:00', end: '15:30', pause: 30, away: 'ab', ret: '19:00', allowance: 21})
  ], {ausOn: true, ausFull: 42, ausHalf: 21});
  await start(); $('[data-view="stats"]').click();
  check('Nr. 20: Feld da, Schätzung 56 €', !!$('#st-nr20') && T($('#st-lstb').textContent).includes('aus deinen Einträgen: 56,00 €'), $('#st-lstb') && T($('#st-lstb').textContent));
  inp(w, $('#st-nr20'), '40'); await wait(10);
  check('Nr. 20 gespeichert', data().settings.nr20['2026'] === 40, JSON.stringify(data().settings.nr20));
  const st = T($('#v-stats').textContent);
  check('Nr. 20 ersetzt die Schätzung', st.includes('abzüglich steuerfreie Verpflegungszuschüsse (Nr. 20)− 40,00 €') && st.includes('weicht um 16,00 €'), st.slice(st.indexOf('Verpflegungsmehraufwand'), st.indexOf('Verpflegungsmehraufwand') + 160));
  check('Reisekosten nach Erstattungen: 16 €', st.includes('Reisekosten nach Erstattungen16,00 €'));
  $('[data-view="more"]').click(); $('#x-xlsx').click(); await wait(1500);
  x = saved.filter(s => s.name.endsWith('.xlsx')).pop();
  wb = new ExcelJS.Workbook(); await wb.xlsx.load(await read(w, x.blob));
  const ov2 = {}; wb.getWorksheet('Übersicht').eachRow(r => { const k = r.getCell(1).value; if (k) ov2[String(k.richText ? k.richText.map(t => t.text).join('') : k)] = r.getCell(2).value; });
  check('Excel: Verpflegung laut Nr. 20', ov2['Steuerfrei erstattet: Verpflegung laut Lohnsteuerbescheinigung Nr. 20'] === -40 && ov2['Schätzung aus den Einträgen (zur Information)'] === 56, JSON.stringify(ov2['Steuerfrei erstattet: Verpflegung laut Lohnsteuerbescheinigung Nr. 20']));
  const an = {}; wb.getWorksheet('Anlage N').eachRow(r => { const z = r.getCell(1).value; if (z && /^\d+$/.test(String(z))) an[z] = r.getCell(3).value; });
  check('Excel Anlage N: Zeilen 73, 74, 77', an['73'] === 2 && an['74'] === 1 && an['77'] === 40, JSON.stringify([an['72'], an['73'], an['74'], an['77']]));
  $('[data-view="stats"]').click();
  inp(w, $('#st-nr20'), '0'); await wait(10);
  check('Nr. 20 = 0 ist erlaubt (nichts steuerfrei)', data().settings.nr20['2026'] === 0 && T($('#v-stats').textContent).includes('Reisekosten nach Erstattungen56,00 €'), '');
  inp(w, $('#st-nr20'), ''); await wait(10);
  check('Nr. 20 leeren: wieder Schätzung', !('2026' in data().settings.nr20) && T($('#v-stats').textContent).includes('abzüglich steuerfreie Auslöse für Verpflegung− 56,00 €'), '');

  // ---------- E: Jahresbericht mit Ausfüllhilfe ----------
  const days = [];
  for (let i = 0; i < 10; i++) { const dt = '2026-03-' + String(2 + i + Math.floor(i / 5) * 2).padStart(2, '0'); days.push(E('s' + i, dt, {shift: 'frueh', start: '05:00', end: '13:30', pause: 30, vehicle: 'pkw', trip: 'sammel', meet: 'Bf Soest', km: 24.6, place: 'Soest'})); }
  days.push(E('t1', '2026-04-06', {type: 'anreise', away: 'an', depart: '10:00', vehicle: 'pkw', km: 210, lodging: 60}));
  days.push(E('t2', '2026-04-07', {shift: 'tag', start: '07:00', end: '15:30', pause: 30, away: 'voll', lodging: 60, meals: {b: true}}));
  days.push(E('t3', '2026-04-08', {shift: 'tag', start: '07:00', end: '15:30', pause: 30, away: 'ab', ret: '19:00', vehicle: 'pkw', km: 210}));
  days.push(E('t4', '2026-04-09', {shift: 'tag', start: '06:00', end: '15:00', pause: 30, away: 'tag', depart: '05:00', ret: '16:00', vehicle: 'firma'}));
  seed(days, {fixed: 'sammel', fixedName: 'Bf Soest', fixedKm: 24.6, veh: 'pkw', name: 'Max Muster'},
    {expenses: [X('x1', '2026-02-01', {amount: 240, cat: 'gew', text: 'IG BAU'}), X('x2', '2026-03-10', {amount: 89.9, cat: 'kleidung', text: 'Sicherheitsschuhe S3'})]});
  await start();
  $('[data-view="more"]').click(); $('#x-report').click(); await wait(30);
  check('Bericht offen, Kopf und Leisten weg', !$('#v-report').hidden && $('#top').hidden && $('#tabs').hidden && JSON.stringify(w.history.state) === '{"r":1}');
  const rows = {}; d.querySelectorAll('#r-paper table.anl tbody tr').forEach(tr => { const td = tr.querySelectorAll('td'); if (td.length === 3) rows[T(td[0].textContent)] = T(td[2].textContent); });
  check('Zeile 27: Sammelpunkt', rows['27'] === '2 = Sammelpunkt', rows['27']);
  check('Zeile 28: Ort und Zeitraum', (rows['28'] || '').startsWith('Bf Soest · 02.03.2026 bis 13.03.2026 · 5'), rows['28']);
  check('Zeile 29/30/31: 10 Tage, 24 km', rows['29'] === '10' && rows['30'] === '24' && rows['31'] === '24', JSON.stringify([rows['29'], rows['30'], rows['31']]));
  check('Zeile 53: Gewerkschaft', rows['53'] === '240,00 €', rows['53']);
  check('Zeile 54/56: Arbeitskleidung', rows['54'] === '89,90 €' && rows['56'] === '89,90 €', rows['54']);
  check('Zeile 65: Firmenwagen ja', rows['65'] === '1 = Ja', rows['65']);
  check('Zeile 66/67/69: Reisekosten', rows['66'] === '126,00 €' && rows['67'] === '120,00 €' && rows['69'] === '246,00 €', JSON.stringify([rows['66'], rows['67'], rows['69']]));
  check('Zeile 72–75: Verpflegung', rows['72'] === '1' && rows['73'] === '2' && rows['74'] === '1' && rows['75'] === '5,60 €', JSON.stringify([rows['72'], rows['73'], rows['74'], rows['75']]));
  check('Zeile 77: geschätzt, Hinweis auf Nr. 20', rows['77'] === '0,00 €' && T($('#r-paper').textContent).includes('Nr. 20 deiner Lohnsteuerbescheinigung ist noch nicht eingetragen'), rows['77']);
  check('Bericht: Name, Monate, Einsatzorte, Ausgaben, alle Tage', ['Max Muster', 'Monate', 'Einsatzorte', 'Ausgaben', 'Alle Tage', 'Sicherheitsschuhe S3'].every(t => T($('#r-paper').textContent).includes(t)), '');
  $('#r-days').checked = false; $('#r-days').dispatchEvent(new w.Event('change')); await wait(10);
  check('Ohne alle Tage', !T($('#r-paper').textContent).includes('Alle Tage'));
  check('Ohne Fotos kein Häkchen für Belege', $('#r-photos-w').hidden);
  $('#r-print').click(); await wait(20);
  check('Drucken / PDF aufgerufen', printed === 1, printed);
  w.dispatchEvent(new w.PopStateEvent('popstate', {state: null})); await wait(10);
  check('Zurück-Taste: wieder Export', !$('#v-more').hidden && $('#v-report').hidden && !$('#tabs').hidden);
  $('[data-view="stats"]').click(); $('[data-report]').click(); await wait(20);
  check('Bericht auch aus der Auswertung', !$('#v-report').hidden);
  $('#r-back').click(); await wait(60);
  check('Zurück-Knopf: wieder Auswertung', !$('#v-stats').hidden && $('#v-report').hidden, view());
  // Bericht ohne Einträge
  seed([]); await start(); $('[data-view="more"]').click(); $('#x-report').click(); await wait(20);
  check('Leerer Bericht', T($('#r-paper').textContent).includes('noch keine Einträge'));

  // ---------- F: Belegfotos ----------
  idb = new IDBFactory();
  seed([]);
  await start(true);
  check('Belege-Feld sichtbar', (() => { d.querySelector('[data-mode="exp"]').click(); d.querySelector('[data-newexp]').click(); return !$('#p-beleg').hidden; })());
  inp(w, $('#p-amount'), '12,50'); inp(w, $('#p-text'), 'Parkhaus');
  const jpg = new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const addFile = (sel, f) => { const fi = $(sel); Object.defineProperty(fi, 'files', {value: [f], configurable: true}); fi.dispatchEvent(new w.Event('change')); };
  addFile('#p-photo-in', new w.File([jpg], 'quittung.jpg', {type: 'image/jpeg'})); await wait(150);
  check('Vorschau zeigt das Foto', d.querySelectorAll('#p-thumbs .thumb img').length === 1, $('#p-thumbs').innerHTML.slice(0, 80));
  addFile('#p-photo-in', new w.File(['hallo'], 'notiz.txt', {type: 'text/plain'})); await wait(100);
  check('Andere Dateien werden übersprungen', d.querySelectorAll('#p-thumbs .thumb').length === 1 && T($('#toast').textContent).includes('übersprungen'));
  $('#f-save').click(); await wait(80);
  const xp = Object.values(data().expenses)[0];
  check('Ausgabe mit Beleg gespeichert', xp && xp.photos.length === 1 && (await idbKeys()).includes(xp.photos[0]), JSON.stringify(xp && xp.photos));
  check('Liste zeigt „1 Beleg“', T($('#v-list').textContent).includes('1 Beleg'));
  // Neuer Tag mit PDF, dann verwerfen: PDF wird wieder gelöscht
  d.querySelector('[data-mode="days"]').click(); openNew('2026-10-12');
  addFile('#f-photo-in', new w.File(['%PDF-1.4 test'], 'hotel.pdf', {type: 'application/pdf'})); await wait(150);
  check('PDF im Tag', T($('#f-thumbs').textContent) === 'PDF' && (await idbKeys()).length === 2);
  $('#f-back').click(); d.querySelector('#f-leave [data-leave="drop"]').click(); await wait(80);
  check('Verworfen: PDF gelöscht', (await idbKeys()).length === 1, JSON.stringify(await idbKeys()));
  // Mehrere Tage: Beleg nur am ersten
  openNew('2026-10-05');
  addFile('#f-photo-in', new w.File([jpg], 'tank.jpg', {type: 'image/jpeg'})); await wait(150);
  $('#b-multi').open = true; inp(w, $('#m-until'), '2026-10-07');
  check('Hinweis: Belege nur am ersten Tag', T($('#m-info').textContent).includes('Belege nur am ersten Tag'));
  $('#f-save').click(); await wait(80);
  const ph = Object.values(data().entries).sort((a, b) => a.date < b.date ? -1 : 1).map(e => e.photos.length).join(',');
  check('Mehrere Tage: Beleg nur am 05.10.', ph === '1,0,0', ph);
  // Sicherung mit Fotos
  $('[data-view="more"]').click();
  check('Häkchen „Belegfotos mitsichern (2)“', !$('#x-photos-w').hidden && T($('#x-photos-l').textContent) === 'Belegfotos mitsichern (2)', T($('#x-photos-l').textContent));
  $('#x-backup').click(); await wait(150);
  const bk = saved.filter(s => s.name.endsWith('.json')).pop(); const bj = JSON.parse((await read(w, bk.blob)).toString());
  const f0 = bj.files.find(f => f.id === xp.photos[0]);
  check('Sicherung enthält die Fotos', bj.version === 4 && bj.files.length === 2 && f0 && Buffer.from(f0.data, 'base64').equals(Buffer.from(jpg)), bj.files.length);
  check('Meldung nennt die Fotos', T($('#b-status').textContent).includes('und 2 Belegfotos gespeichert'), T($('#b-status').textContent));
  $('#x-photos').checked = false; $('#x-backup').click(); await wait(100);
  const bj2 = JSON.parse((await read(w, saved.filter(s => s.name.endsWith('.json')).pop().blob)).toString());
  check('Ohne Häkchen: keine Fotos', bj2.files.length === 0);
  // Foto entfernen ohne Speichern: bleibt; mit Speichern: weg
  d.querySelector('[data-view="list"]').click(); d.querySelector('[data-mode="exp"]').click();
  d.querySelector('[data-exp]').click(); await wait(80);
  d.querySelector('#p-thumbs [data-photo]').click(); await wait(50);
  check('Foto groß ansehen', !$('#viewer').hidden && !!$('#v-body img'));
  $('#v-del').click(); await wait(50);
  check('Aus dem Formular entfernt', $('#viewer').hidden && !d.querySelector('#p-thumbs .thumb'));
  $('#p-back').click(); d.querySelector('#p-leave [data-leave="drop"]').click(); await wait(80);
  check('Verworfen: Foto noch da', Object.values(data().expenses)[0].photos.length === 1 && (await idbKeys()).includes(xp.photos[0]));
  d.querySelector('[data-exp]').click(); await wait(80);
  d.querySelector('#p-thumbs [data-photo]').click(); await wait(50); $('#v-del').click(); await wait(20);
  $('#f-save').click(); await wait(80);
  check('Gespeichert: Foto gelöscht', Object.values(data().expenses)[0].photos.length === 0 && !(await idbKeys()).includes(xp.photos[0]), JSON.stringify(await idbKeys()));
  // Löschen eines Tages löscht seine Fotos
  d.querySelector('[data-mode="days"]').click();
  const withPh = Object.values(data().entries).find(e => e.photos.length);
  openId(withPh.id); await wait(50); $('#f-delete').click(); $('#f-delete').click(); await wait(80);
  check('Tag gelöscht: Foto gelöscht', (await idbKeys()).length === 0, JSON.stringify(await idbKeys()));
  // Sicherung laden bringt die Fotos zurück
  const file = new w.File([JSON.stringify(bj)], 'sicherung.json', {type: 'application/json'});
  $('[data-view="more"]').click();
  const fi = $('#x-restore'); Object.defineProperty(fi, 'files', {value: [file], configurable: true}); fi.dispatchEvent(new w.Event('change')); await wait(200);
  check('Sicherung laden: Fotos zurück', (await idbKeys()).length === 2 && T($('#b-status').textContent).includes('mit 2 Belegfotos'), T($('#b-status').textContent));
  // Bericht mit Belegen
  $('#x-report').click(); await wait(50);
  check('Bericht: Häkchen für Belege', !$('#r-photos-w').hidden && T($('#r-photos-l').textContent) === 'Belegfotos anhängen (2 Belege)', T($('#r-photos-l').textContent));
  $('#r-photos').checked = true; $('#r-photos').dispatchEvent(new w.Event('change')); await wait(150);
  check('Bericht: Belege angehängt', d.querySelectorAll('#r-belege .beleg img').length === 2, d.querySelectorAll('#r-belege .beleg').length);
  w.dispatchEvent(new w.PopStateEvent('popstate', {state: null})); await wait(10);
  // Aufräumen beim Start: alte, nicht mehr gebrauchte Fotos weg, frische bleiben
  await idbPut({id: 'b1600000000000-alt', type: 'image/jpeg', buf: new ArrayBuffer(4)});
  await idbPut({id: 'b' + H.NOW + '-neu', type: 'image/jpeg', buf: new ArrayBuffer(4)});
  await start(true); await wait(100);
  const keys = await idbKeys();
  check('Aufräumen: alte Waise weg, neue bleibt, benutzte bleiben', !keys.includes('b1600000000000-alt') && keys.includes('b' + H.NOW + '-neu') && keys.length === 3, JSON.stringify(keys));
  // Ohne IndexedDB: kein Belege-Feld
  await start(false); openNew('2026-10-12');
  check('Ohne Gerätedatenbank: Belege ausgeblendet', $('#b-beleg').hidden);

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
