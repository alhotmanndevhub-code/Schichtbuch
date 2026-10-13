// Gesetzliche Werte fest je Steuerjahr, nicht änderbar
const {JSDOM} = require('jsdom'); const H = require('./helpers'); const fs = require('fs');
const html = fs.readFileSync(H.ROOT + '/index.html', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
const E = (id, date, o) => Object.assign({id, date, type: 'arbeit', shift: 'frueh', start: '05:00', end: '13:00', pause: 0, away: 'none', meals: {}, vehicle: 'pkw', trip: 'sammel', km: 35, updated: ''}, o);
// alte Einstellungen mit manuell veränderten Sätzen: müssen ignoriert werden
const store = {[KEY]: JSON.stringify({entries: {a: E('a', '2025-03-03'), b: E('b', '2026-03-03'), c: E('c', '2027-03-03')},
  expenses: {g: {id: 'g', date: '2025-05-01', amount: 200, cat: 'gew'}, h: {id: 'h', date: '2026-05-01', amount: 200, cat: 'gew'}},
  settings: {profSeen: true, rateSmall: 99, rateFull: 99, kmRate: 9, commuteRate: 9, wkp: 1, ausFull: 0}, lastBackup: H.nowIso()})};
const dom = new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { H.installClock(w); Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = String(v)}}); w.scrollTo = () => {}; }});
const T = s => (s || '').replace(/\s+/g, ' ').trim();
setTimeout(() => {
  const w = dom.window, d = w.document; let fails = 0;
  const check = (n, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + n + (info ? ' | ' + info : '')); };
  const setYear = y => { const sel = d.querySelector('#year'); sel.value = String(y); sel.dispatchEvent(new w.Event('change')); };
  d.querySelector('#nav-settings').click();
  check('Keine Eingabefelder für gesetzliche Werte', !d.querySelector('#s-small, #s-full, #s-km, #s-commute, #s-wkp'));
  check('Gesetzliche Werte 2026 angezeigt', T(d.querySelector('#law-table').textContent).includes('Entfernungspauschale je km einfach0,38 € je km') && T(d.querySelector('#law-card summary').textContent) === 'Gesetzliche Werte 2026', T(d.querySelector('#law-table').textContent).slice(0, 120));
  setYear(2025);
  check('Gesetzliche Werte 2025 angezeigt', T(d.querySelector('#law-table').textContent).includes('0,30 € je km bis 20 km, ab dem 21. km 0,38 €') && T(d.querySelector('#law-table').textContent).includes('im Pauschbetrag enthalten'), '');
  d.querySelector('[data-view="stats"]').click();
  let t = T(d.querySelector('#v-stats').textContent);
  // 2025: 20 × 0,30 + 15 × 0,38 = 6,00 + 5,70 = 11,70
  check('2025: Entfernungspauschale gestaffelt 11,70 €', t.includes('1 Tag, zusammen 35 km einfach (0,30 € je km bis 20 km, ab dem 21. km 0,38 €)11,70 €'), t.slice(t.indexOf('1 Tag'), t.indexOf('1 Tag') + 90));
  check('2025: Gewerkschaft im Pauschbetrag', t.includes('Gewerkschaftsbeiträge zählen in 2025 noch zum Pauschbetrag'));
  check('Manuelle alte Sätze ignoriert (Pauschbetrag 1.230 €)', t.includes('Arbeitnehmer-Pauschbetrag von 1.230 €'));
  setYear(2026); t = T(d.querySelector('#v-stats').textContent);
  check('2026: 35 × 0,38 = 13,30 €', t.includes('35 km einfach × 0,38 €13,30 €'));
  check('2026: Gewerkschaft zusätzlich', t.includes('Gewerkschaftsbeiträge (200,00 €) zählen zusätzlich zum Pauschbetrag'));
  setYear(2027); t = T(d.querySelector('#v-stats').textContent);
  check('2027: Hinweis keine Werte, gerechnet mit 2026', t.includes('Für 2027 sind noch keine gesetzlichen Werte hinterlegt. Gerechnet wird mit den Werten von 2026'));
  console.log(fails ? fails + ' Fehler' : 'Alles bestanden'); process.exit(fails ? 1 : 0);
}, 100);
