// Test Version 1.3.0: Deine Arbeit, Verrechnung, Mitternachtsregel, Dreimonatsfrist, zwei Fenster, defekte Daten
const {JSDOM} = require('jsdom'); const fs = require('fs'); const ExcelJS = require('exceljs');
const H = require('./helpers');
const DIR = H.ROOT + '/';
const html = fs.readFileSync(DIR + 'index.html', 'utf8');
const excelSrc = fs.readFileSync(DIR + 'exceljs.min.js', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
let store = {};
const saved = [];
function boot() {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) { H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k]}});
      w.scrollTo = () => {}; w.eval(excelSrc);
      const blobs = {}; let n = 0;
      w.URL.createObjectURL = b => { const u = 'blob:x' + (++n); blobs[u] = b; return u; }; w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { saved.push({name: this.download, blob: blobs[this.href]}); };
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
const read = (w, blob) => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(Buffer.from(fr.result)); fr.readAsArrayBuffer(blob); });
const inp = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', {bubbles: true})); el.dispatchEvent(new w.Event('change', {bubbles: true})); };
const data = () => JSON.parse(store[KEY]);
const ents = () => Object.values(data().entries);
const byDate = dt => ents().filter(e => e.date === dt);
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const E = (id, date, o) => Object.assign({id, date, year: +date.slice(0, 4), type: 'arbeit', shift: '', start: '', end: '', pause: 0, travelMin: 0, place: '', line: '', project: '', away: 'none',
  depart: '', ret: '', meals: {}, lodging: 0, lodgingName: '', vehicle: '', trip: 'dienst', meet: '', km: 0, allowance: 0, otherCost: 0, otherNote: '', note: '', updated: '2026-01-01T00:00:00Z'}, o);
const seed = (entries, settings, extra) => { store = {}; const m = {}; entries.forEach(e => m[e.id] = e); store[KEY] = JSON.stringify(Object.assign({version: 4, entries: m, expenses: {}, settings: Object.assign({ausFull: 0}, settings || {}), lastBackup: H.nowIso()}, extra || {})); };

(async () => {
  // ---------- A: neuer Nutzer, „Deine Arbeit“ einrichten ----------
  store = {};
  let dom = boot(), w = dom.window, d = w.document; await wait(50);
  let $ = s => d.querySelector(s);
  const openNew = date => { const b = d.createElement('button'); b.dataset.new = date; $('#v-list').appendChild(b); b.click(); b.remove(); };
  const openId = id => { const b = d.createElement('button'); b.dataset.id = id; $('#v-list').appendChild(b); b.click(); b.remove(); };
  const save = async () => { $('#f-save').click(); await wait(20); };
  const pressed = g => [...d.querySelectorAll(g + ' [aria-pressed="true"]')].map(b => b.dataset.v).join(',');
  check('Neuer Nutzer: Hinweis zum Einrichten', T($('#v-list').textContent).includes('Stell einmal ein, wie deine Firma es regelt'));
  $('#v-list [data-go="settings"]').click(); await wait(10);
  check('Einrichten öffnet Einstellungen', !$('#v-settings').hidden && $('#nav-settings').getAttribute('aria-current') === 'page');
  check('Neuer Nutzer: Auslöse aus, Beträge leer', pressed('[data-pset="ausOn"]') === '0' && $('#p-aus-w').hidden && $('#s-aus-full').value === '', pressed('[data-pset="ausOn"]'));
  $('[data-pset="veh"] [data-v="mit"]').click();
  $('[data-pset="fixed"] [data-v="sammel"]').click();
  check('Fester Ort: Felder und Hinweis', !$('#p-fixed-w').hidden && T($('#p-fixed-h').textContent).includes('auch als Mitfahrer'), T($('#p-fixed-h').textContent).slice(0, 60));
  inp(w, $('#p-fixed-name'), 'Bf Soest'); inp(w, $('#p-fixed-km'), '24');
  $('[data-pset="lodgingBy"] [data-v="firma"]').click();
  $('[data-pset="travelPaid"] [data-v="0"]').click();
  const st = data().settings;
  check('Einstellungen sofort gespeichert', st.veh === 'mit' && st.fixed === 'sammel' && st.fixedName === 'Bf Soest' && st.fixedKm === 24 && st.lodgingBy === 'firma' && st.travelPaid === false && st.profSeen === true, JSON.stringify({v: st.veh, f: st.fixed, n: st.fixedName, k: st.fixedKm, l: st.lodgingBy, t: st.travelPaid, p: st.profSeen}));
  $('[data-view="list"]').click(); await wait(10);
  check('Hinweis zum Einrichten verschwindet', !T($('#v-list').textContent).includes('Stell einmal ein'));
  // Neuer Tag: vorausgefüllt als Mitfahrer zum Sammelpunkt
  openNew('2026-10-05');
  check('Neuer Tag: Mitfahrer + Sammelpunkt vorausgefüllt', pressed('#g-vehicle') === 'mit' && pressed('#g-trip') === 'sammel' && $('#f-meet').value === 'Bf Soest' && $('#f-km').value === '24', pressed('#g-vehicle') + '/' + pressed('#g-trip') + '/' + $('#f-meet').value + '/' + $('#f-km').value);
  $('#g-shift [data-v="frueh"]').click();
  check('Mitfahrer Sammelpunkt: Entfernungspauschale', T($('#c-drive').textContent).startsWith('24 km × 0,38 € = 9,12 €') && T($('#c-drive').textContent).includes('höchstens 4.500 €'), T($('#c-drive').textContent));
  await save();
  // Firmenbus: keine Pauschale
  openNew('2026-10-06'); $('#g-shift [data-v="frueh"]').click(); $('#g-vehicle [data-v="firma"]').click();
  check('Firmenbus: Hinweis Sammelbeförderung', T($('#c-drive').textContent).includes('Sammelbeförderung') && $('#w-trip').hidden);
  await save();
  check('Firmenbus gespeichert ohne Sammelpunkt-km', byDate('2026-10-06')[0].trip === 'dienst' && byDate('2026-10-06')[0].km === 0 && byDate('2026-10-06')[0].meet === 'Bf Soest', JSON.stringify(byDate('2026-10-06')[0].trip));
  // Anreise: Fahrzeit-Feld aus (nicht angerechnet), Unterkunftskosten-Feld aus (zahlt die Firma)
  openNew('2026-10-11'); $('#f-clear').click(); $('#g-type [data-v="anreise"]').click();
  check('Fahrzeit nicht angerechnet: Feld aus', $('#b-travel').hidden);
  check('Unterkunft zahlt Firma: Kostenfeld aus, Name da', $('#w-lodging-cost').hidden && !$('#w-lodging').hidden);
  $('#f-back').click(); await wait(10); if (!$('#f-leave').hidden) { d.querySelector('[data-leave="drop"]').click(); await wait(10); }
  $('[data-view="stats"]').click(); await wait(10);
  const tt = T($('.ttable').textContent);
  check('Auswertung: Sammelpunkt 1 Tag 9,12 €', tt.includes('Fester Sammelpunkt1 Tag, zusammen 24 km einfach × 0,38 €9,12 €'), tt.slice(tt.indexOf('Fester'), tt.indexOf('Fester') + 80));
  check('Auswertung: Angaben zur Arbeit', T($('#v-stats').textContent).includes('Gerechnet mit deinen Angaben: Meistens unterwegs: als Mitfahrer · Fester Ort laut Vertrag: Sammelpunkt Bf Soest, 24 km einfach · Auslöse: keine · Unterkunft zahlt: die Firma'), '');

  // ---------- B: Verrechnung Auslöse und Kilometergeld ----------
  seed([
    E('a', '2026-10-11', {type: 'anreise', away: 'an', vehicle: 'pkw', km: 300, allowance: 21}),
    E('b', '2026-10-12', {shift: 'frueh', start: '05:00', end: '13:30', pause: 30, away: 'voll', lodging: 50, allowance: 42}),
    E('c', '2026-10-13', {shift: 'frueh', start: '05:00', end: '13:30', pause: 30, away: 'ab', vehicle: 'pkw', km: 300, allowance: 21, meals: {b: true}}),
    E('old1', '2026-09-07', {away: 'an'}), E('old2', '2026-09-08', {away: 'voll'}), E('old3', '2026-09-09', {away: 'ab'})
  ], {ausOn: true, ausFull: 42, ausHalf: 21, lodgingBy: 'self', profSeen: true});
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50); $ = s => d.querySelector(s);
  $('[data-view="stats"]').click(); await wait(10);
  let t2 = T($('.ttable').textContent);
  // Verpflegung: 14 + 28 + (14 − 5,60 Frühstück = 8,40) = 50,40; Auslöse verrechnet: 14 + 28 + 8,40 = 50,40; Rest 42 − 28 = 14 mit Übernachtung 50
  // Fahrtkosten 600 km × 0,30 = 180 bleiben ganz; Übernachtung 50 − 14 = 36 → 216,00; dazu September-Tage ohne Auslöse 14 + 28 + 14 = 56 → 272,00
  check('Verrechnung: Verpflegung', t2.includes('abzüglich steuerfreie Auslöse für Verpflegung− 50,40 €'), t2.match(/abzüglich steuerfreie[^€]*€/));
  check('Verrechnung: Übernachtung', t2.includes('abzüglich Auslöse für Übernachtung− 14,00 €'), t2.match(/Auslöse für Übernachtung[^€]*€/));
  check('Verrechnung: Fahrtkosten bleiben', t2.includes('Reisekosten nach Erstattungen272,00 €'), t2.match(/Reisekosten nach Erstattungen[^€]*€/));
  // Kilometergeld 0,20 €/km
  $('#nav-settings').click(); $('[data-pset="kmOn"] [data-v="1"]').click(); inp(w, $('#p-kmgeld'), '0,20');
  $('[data-view="stats"]').click(); await wait(10); t2 = T($('.ttable').textContent);
  check('Kilometergeld verrechnet', t2.includes('abzüglich Kilometergeld der Firma− 120,00 €') && t2.includes('Reisekosten nach Erstattungen152,00 €'), t2.match(/Kilometergeld[^€]*€/));
  // Auslöse bei alten Tagen nachtragen + Rückgängig
  $('#nav-settings').click();
  check('Nachtragen-Knopf zeigt 3 Tage', !$('#p-aus-fill').hidden && $('#p-aus-fill').textContent.includes('Bei 3 bisherigen Tagen'), $('#p-aus-fill').textContent);
  $('#p-aus-fill').click(); await wait(10);
  check('Nachgetragen 21/42/21', ['2026-09-07', '2026-09-08', '2026-09-09'].map(x => byDate(x)[0].allowance).join(',') === '21,42,21');
  $('#toast button').click(); await wait(10);
  check('Rückgängig', ['2026-09-07', '2026-09-08', '2026-09-09'].map(x => byDate(x)[0].allowance).join(',') === '0,0,0');
  // Excel: Erstattungen und Angaben zur Arbeit
  $('[data-view="more"]').click(); $('#x-xlsx').click(); await wait(1500);
  let x = saved.filter(s => s.name.endsWith('.xlsx')).pop();
  let wb = new ExcelJS.Workbook(); await wb.xlsx.load(await read(w, x.blob));
  const o = {}; wb.getWorksheet('Übersicht').eachRow(r => { const k = r.getCell(1).value; if (k) o[typeof k === 'object' ? k.richText ? k.richText.map(t => t.text).join('') : String(k) : String(k)] = r.getCell(2).value; });
  check('Excel: Erstattungen', o['Steuerfrei erstattet: Auslöse für Verpflegung'] === -50.4 && o['Steuerfrei erstattet: Auslöse für Übernachtung'] === -14 && o['Steuerfrei erstattet: Kilometergeld'] === -120, JSON.stringify([o['Steuerfrei erstattet: Auslöse für Verpflegung'], o['Steuerfrei erstattet: Auslöse für Übernachtung'], o['Steuerfrei erstattet: Kilometergeld']]));
  check('Excel: Angaben zur Arbeit', o['Auslöse'] === 'ganzer Tag 42 €, An-/Abreise 21 €' && o['Kilometergeld'] === '0,20 € je km', JSON.stringify([o['Auslöse'], o['Kilometergeld']]));

  // ---------- C: Mitternachtsregel ----------
  seed([
    E('n1', '2026-10-31', {shift: 'nacht', start: '21:00', end: '05:00', away: 'tag', depart: '20:00', ret: '06:30'}),   // 4 h + 6,5 h -> 1.11.
    E('n2', '2026-10-20', {shift: 'nacht', start: '18:00', end: '02:00', away: 'tag', depart: '16:00', ret: '03:00'}),   // 8 h + 3 h -> 20.10.
    E('n3', '2025-12-31', {shift: 'nacht', start: '22:00', end: '06:00', away: 'tag', depart: '21:00', ret: '07:00'})    // -> 1.1.2026
  ], {profSeen: true});
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50); $ = s => d.querySelector(s);
  $('[data-view="stats"]').click(); await wait(10);
  const mrows = [...d.querySelectorAll('.mrow')].map(r => T(r.textContent));
  check('Mitternachtsregel: Oktober 14 €, November 14 €, Januar 14 € aus 31.12.2025', mrows.some(r => r.startsWith('Okt') && r.endsWith('14 €')) && mrows.some(r => r.startsWith('Nov') && r.endsWith('14 €')) && mrows.some(r => r.startsWith('Jan') && r.endsWith('14 €')), mrows.filter(r => !r.endsWith('–')).join(' | '));
  $('[data-view="list"]').click(); await wait(10);
  openId('n1');
  check('Formular: zählt für So 01.11.', T($('#c-away').textContent).includes('zählt für So 01.11., dort warst du länger unterwegs'), T($('#c-away').textContent));
  $('#f-back').click(); await wait(10);

  // ---------- D: Dreimonatsfrist mit 3 Tagen pro Woche ----------
  const mk = (pref, days, place) => { const out = []; let dt = new Date(2026, 0, 5); let i = 0; while (dt < new Date(2026, 5, 1)) { const dow = dt.getDay(); if (days.includes(dow)) { const iso = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); out.push(E(pref + (i++), iso, {away: 'tag', depart: '05:00', ret: '16:00', place})); } dt.setDate(dt.getDate() + 1); } return out; };
  seed(mk('z', [1, 2], 'Zweitage-Ort').concat(mk('d', [3, 4, 5], 'Dreitage-Ort')), {profSeen: true});
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50); $ = s => d.querySelector(s);
  $('[data-view="stats"]').click(); await wait(10);
  const places = [...d.querySelectorAll('.place')].map(p => T(p.textContent));
  const p2 = places.find(p => p.startsWith('Zweitage')), p3 = places.find(p => p.startsWith('Dreitage'));
  check('Dreimonatsfrist: 2 Tage/Woche ohne Warnung', p2 && !p2.includes('Dreimonatsfrist'), p2);
  check('Dreimonatsfrist: 3 Tage/Woche mit Warnung ab 07.04.2026', p3 && p3.includes('Seit 07.01.2026 regelmäßig') && p3.includes('Ab 07.04.2026'), p3 && p3.slice(-160));

  // ---------- E: 4.500-€-Grenze ohne eigenes Auto ----------
  const many = []; for (let i = 0; i < 300; i++) { const dt = new Date(2026, 0, 1 + i); const iso = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); many.push(E('m' + i, iso, {vehicle: 'mit', trip: 'sammel', km: 50})); }
  seed(many, {profSeen: true});
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50); $ = s => d.querySelector(s);
  $('[data-view="stats"]').click(); await wait(10);
  const t5 = T($('.ttable').textContent);
  check('Ohne eigenes Auto höchstens 4.500 €', t5.includes('300 Tage, zusammen 15.000 km einfach × 0,38 €4.500,00 €') && t5.includes('ohne eigenes Auto höchstens 4.500 € im Jahr'), t5.slice(t5.indexOf('300 Tage'), t5.indexOf('300 Tage') + 90));

  // ---------- F: zwei Fenster gleichzeitig ----------
  seed([E('k1', '2026-10-01', {shift: 'frueh', start: '05:00', end: '13:00'}), E('k2', '2026-10-02', {shift: 'frueh', start: '05:00', end: '13:00'})], {profSeen: true});
  dom.window.close();
  const A = boot(), B = boot(); await wait(60);
  const aw = A.window, bw = B.window, ad = aw.document, bd = bw.document;
  const openNewIn = (dd, date) => { const b = dd.createElement('button'); b.dataset.new = date; dd.querySelector('#v-list').appendChild(b); b.click(); b.remove(); };
  openNewIn(ad, '2026-10-05'); ad.querySelector('#f-clear').click(); ad.querySelector('#g-shift [data-v="tag"]').click(); ad.querySelector('#f-save').click(); await wait(20);
  // Fenster B weiß nichts von A: neuer Eintrag und Löschen von k1
  openNewIn(bd, '2026-10-06'); bd.querySelector('#f-clear').click(); bd.querySelector('#g-shift [data-v="spaet"]').click(); bd.querySelector('#f-save').click(); await wait(20);
  const del = bd.createElement('button'); del.dataset.id = 'k1'; bd.querySelector('#v-list').appendChild(del); del.click(); del.remove();
  bd.querySelector('#f-delete').click(); bd.querySelector('#f-delete').click(); await wait(20);
  const dates = ents().map(e => e.date).sort().join(',');
  check('Zwei Fenster: beide neuen Einträge bleiben, Löschen wirkt', dates === '2026-10-02,2026-10-05,2026-10-06', dates);
  aw.dispatchEvent(new aw.Event('focus')); await wait(20);
  const al = T(ad.querySelector('#v-list').textContent);
  check('Fenster A übernimmt Stand von B', al.includes('Mo06') || al.includes('Di06') || al.includes('06'), '');
  check('Fenster A zeigt gelöschten Tag nicht mehr', !ad.querySelector('[data-id="k1"]'));
  A.window.close(); B.window.close();

  // ---------- G: defekte Daten ----------
  store = {[KEY]: '{"entries": {kaputt'};
  dom = boot(); w = dom.window; d = w.document; await wait(50); $ = s => d.querySelector(s);
  check('Defekte Daten: Hinweis', T($('#v-list').textContent).includes('ließen sich nicht lesen') && T($('#v-list').textContent).includes('Eine Kopie davon ist aufgehoben'));
  check('Defekte Daten: Kopie aufgehoben', store[KEY + '-defekt'] === '{"entries": {kaputt');
  $('[data-broken="dl"]').click(); await wait(10);
  check('Defekte Daten herunterladen', saved.some(s => s.name === 'Schichtbuch_defekte_Daten.txt'));
  openNew('2026-10-07'); $('#g-shift [data-v="frueh"]').click(); await save();
  check('Nach defekten Daten: neu speichern geht, Kopie bleibt', ents().length === 1 && store[KEY + '-defekt'] === '{"entries": {kaputt');

  // ---------- H: Erinnerung wöchentlich, Bayern-Feiertag ----------
  seed([E('r1', '2026-10-01', {}), E('r2', '2026-10-02', {}), E('r3', '2026-10-05', {})], {profSeen: true, state: 'BY'}, {lastBackup: H.nowIso(-8)});
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50); $ = s => d.querySelector(s);
  check('Erinnerung nach 8 Tagen', T($('#v-list').textContent).includes('Letzte Datensicherung: vor 8 Tagen'));
  seed([E('r1', '2026-10-01', {}), E('r2', '2026-10-02', {}), E('r3', '2026-10-05', {})], {profSeen: true, state: 'BY'}, {lastBackup: H.nowIso(-6)});
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50); $ = s => d.querySelector(s);
  check('Keine Erinnerung nach 6 Tagen', !T($('#v-list').textContent).includes('Letzte Datensicherung'));
  openNew('2026-08-15');
  check('Bayern: Mariä Himmelfahrt', T($('#f-hol').textContent) === 'Feiertag: Mariä Himmelfahrt (in vielen Gemeinden)', T($('#f-hol').textContent));
  $('#f-back').click(); await wait(10);
  // Werbungskosten-Hinweise
  $('[data-mode="exp"]').click(); d.querySelector('[data-newexp]').click(); await wait(10);
  d.querySelector('#g-cat [data-v="mittel"]').click();
  check('Hinweis Arbeitsmittel', T($('#h-cat').textContent).includes('952 €') && T($('#h-cat').textContent).includes('20 % der Rechnung'), T($('#h-cat').textContent));
  d.querySelector('#g-cat [data-v="sonst"]').click();
  check('Hinweis Kontoführung', T($('#h-cat').textContent).includes('16 €'));

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
