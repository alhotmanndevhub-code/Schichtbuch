// Vorgaben aus „Deine Arbeit“ bei Vorlage ohne Fahrzeug; Header passt in eine Zeile
const {JSDOM} = require('jsdom'); const H = require('./helpers'); const fs = require('fs');
const html = fs.readFileSync(H.ROOT + '/index.html', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
const store = {[KEY]: JSON.stringify({version: 4, rev: 3, entries: {w1: {id: 'w1', date: '2026-10-05', type: 'arbeit', shift: 'frueh', start: '05:00', end: '13:30', pause: 30, away: 'none', vehicle: '', meals: {}}},
  settings: {profSeen: true, veh: 'mit', fixed: 'sammel', fixedName: 'Bf Soest', fixedKm: 24, ausFull: 0}})};
const dom = new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { H.installClock(w); Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = String(v)}}); w.scrollTo = () => {}; }});
setTimeout(() => {
  const d = dom.window.document; let fails = 0;
  const b = d.createElement('button'); b.dataset.new = '2026-10-06'; d.querySelector('#v-list').appendChild(b); b.click();
  const pressed = g => [...d.querySelectorAll(g + ' [aria-pressed="true"]')].map(x => x.dataset.v).join(',');
  const ok = pressed('#g-vehicle') === 'mit' && pressed('#g-trip') === 'sammel' && d.querySelector('#f-km').value === '24' && pressed('#g-shift') === 'frueh';
  console.log((ok ? 'OK   ' : 'FEHL ') + 'Vorlage ohne Fahrzeug nimmt Vorgaben', pressed('#g-vehicle'), pressed('#g-trip'), d.querySelector('#f-km').value, pressed('#g-shift'));
  if (!ok) fails++;
  // Speichern hebt rev an, REV-Schlüssel gesetzt
  d.querySelector('#f-save').click();
  const o = JSON.parse(store[KEY]);
  const ok2 = o.rev > 3 && store[KEY + '-rev'] === String(o.rev) && o.version === 4 && Object.keys(o.entries).length === 2;
  console.log((ok2 ? 'OK   ' : 'FEHL ') + 'Speichernummer', o.rev, store[KEY + '-rev']); if (!ok2) fails++;
  console.log(fails ? fails + ' Fehler' : 'Alles bestanden'); process.exit(fails ? 1 : 0);
}, 80);
