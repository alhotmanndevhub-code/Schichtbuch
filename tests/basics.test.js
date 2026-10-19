// Grundfunktionen: Eintrag anlegen, Neustart, Excel, Sicherung, Import, Erinnerung, Zurück-Taste
const {JSDOM} = require('jsdom'); const fs = require('fs'); const ExcelJS = require('exceljs');
const H = require('./helpers');
const html = fs.readFileSync(H.ROOT + '/index.html', 'utf8');
const excelSrc = fs.readFileSync(H.ROOT + '/exceljs.min.js', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
const store = {}; const saved = [];
function boot() {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) {
      H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }}});
      w.scrollTo = () => {}; w.eval(excelSrc);
      const blobs = {}; let n = 0;
      w.URL.createObjectURL = b => { const u = 'blob:x' + (++n); blobs[u] = b; return u; }; w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { saved.push({name: this.download, blob: blobs[this.href]}); };
      w.File.prototype.text = function () { return new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(this); }); };
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
const read = (w, blob) => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(Buffer.from(fr.result)); fr.readAsArrayBuffer(blob); });
const inp = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input')); };
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };

(async () => {
  let dom = boot(), w = dom.window, d = w.document; await wait(50);
  check('Start leer: Willkommen, darunter leere Startseite', !d.querySelector('#v-welcome').hidden && T(d.querySelector('#v-list .empty h2').textContent) === 'Noch keine Einträge' && d.querySelector('#sync').textContent === 'Gespeichert');
  d.querySelector('#nav-add').click();
  check('Formular legt Verlaufseintrag an (Zurück-Taste)', JSON.stringify(w.history.state) === '{"f":1}');
  d.querySelector('#f-clear').click();
  d.querySelector('#g-shift [data-v="nacht"]').click();
  d.querySelector('#g-pause [data-v="30"]').click();
  d.querySelector('#g-away [data-v="tag"]').click();
  inp(w, d.querySelector('#f-depart'), '21:00'); inp(w, d.querySelector('#f-ret'), '07:00');
  inp(w, d.querySelector('#f-place'), 'Hamm (Westf)');
  d.querySelector('#g-vehicle [data-v="pkw"]').click(); inp(w, d.querySelector('#f-km'), '96');
  check('Rechnung Arbeitszeit', T(d.querySelector('#c-work').textContent) === 'Arbeitszeit 7,5 hüber Mitternacht', T(d.querySelector('#c-work').textContent));
  const ca = T(d.querySelector('#c-away').textContent);
  check('Rechnung Verpflegung mit Mitternachtsregel', ca.startsWith('Unterwegs 10 hVerpflegungspauschale 14,00 €') && ca.includes('zählt für Mi 14.10.'), ca);
  check('Rechnung Fahrt', T(d.querySelector('#c-drive').textContent) === '96 km × 0,30 € = 28,80 €', T(d.querySelector('#c-drive').textContent));
  d.querySelector('#f-save').click(); await wait(20);
  check('Gespeichert', d.querySelector('#toast').textContent === 'Gespeichert' && w.history.state === null && Object.keys(JSON.parse(store[KEY]).entries).length === 1);
  // Ausgabe
  d.querySelector('[data-mode="exp"]').click(); d.querySelector('[data-newexp]').click();
  inp(w, d.querySelector('#p-amount'), '89,90'); inp(w, d.querySelector('#p-text'), 'Sicherheitsschuhe S3');
  d.querySelector('#f-save').click(); await wait(20);
  check('Ausgabe gespeichert', Object.keys(JSON.parse(store[KEY]).expenses).length === 1);
  // Neustart
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50);
  const row = T(d.querySelector('#v-list .rows').textContent);
  check('Nach Neustart noch da', row.includes('Nacht22:00–06:00TagestourHamm (Westf) 7,5 h14 € · 96 km'), row.slice(0, 90));
  // Excel
  d.querySelector('[data-view="more"]').click();
  check('Version angezeigt', /^Version \d+\.\d+\.\d+/.test(d.querySelector('#about-ver').textContent), d.querySelector('#about-ver').textContent);
  d.querySelector('#x-xlsx').click(); await wait(1500);
  const x = saved.find(s => s.name.endsWith('.xlsx'));
  check('Excel-Datei erzeugt', x && x.name === 'MontageBuch_2026.xlsx');
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await read(w, x.blob));
  check('Excel-Blätter', wb.worksheets.map(s => s.name).join(',') === 'Übersicht,Einträge,Ausgaben,Monate,Einsatzorte,Anlage N');
  const ws = wb.getWorksheet('Einträge'), hd = ws.getRow(1).values.slice(1), r = ws.getRow(2), c = n => r.getCell(hd.indexOf(n) + 1).value;
  check('Excel-Zeile', c('Schicht') === 'Nacht' && c('Arbeitszeit (Std.)') === 7.5 && c('Verpflegung (€)') === 14 && c('km Dienstfahrt') === 96 && c('Fahrtkosten (€)') === 28.8,
    JSON.stringify([c('Schicht'), c('Arbeitszeit (Std.)'), c('Verpflegung (€)'), c('km Dienstfahrt'), c('Fahrtkosten (€)')]));
  // Sicherung
  d.querySelector('#x-backup').click(); await wait(50);
  const b = saved.find(s => s.name.endsWith('.json')); const bj = JSON.parse((await read(w, b.blob)).toString());
  check('Sicherung', b.name === 'MontageBuch_Sicherung_2026-10-13.json' && bj.entries.length === 1 && bj.expenses.length === 1 && !!JSON.parse(store[KEY]).lastBackup, b.name);
  // Import einer Sicherung im alten Format (12 Einträge)
  const old = {app: 'sakra-schichtbuch', version: 2, settings: {name: 'Test', state: 'NW'}, entries: [], expenses: [{id: 'x1', date: '2026-03-14', amount: 240, cat: 'gew', text: 'Beitrag'}]};
  for (let i = 0; i < 12; i++) old.entries.push({id: 'old' + i, date: '2026-09-' + String(i + 1).padStart(2, '0'), year: 2026, type: 'arbeit', shift: 'frueh', start: '05:00', end: '13:30', pause: 30, away: 'tag', depart: '04:00', ret: '15:00', meals: {}});
  const file = new w.File([JSON.stringify(old)], 'alt.json', {type: 'application/json'});
  const fi = d.querySelector('#x-restore'); Object.defineProperty(fi, 'files', {value: [file], configurable: true}); fi.dispatchEvent(new w.Event('change'));
  await wait(100);
  check('Sicherung laden', d.querySelector('#b-status').textContent === '12 Arbeitstage und 1 Ausgabe aus der Sicherung übernommen.' && d.querySelector('#s-name').value === 'Test', d.querySelector('#b-status').textContent);
  // Erinnerung an die Sicherung
  const st = JSON.parse(store[KEY]); st.lastBackup = '2026-08-01T10:00:00.000Z'; store[KEY] = JSON.stringify(st);
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50);
  check('Erinnerung an die Sicherung', T(d.querySelector('#v-list').textContent).includes('Letzte Datensicherung: vor 73 Tagen'));
  // Zurück-Taste mit ungespeicherter Änderung
  d.querySelector('#nav-add').click(); inp(w, d.querySelector('#f-note'), 'Test');
  w.dispatchEvent(new w.PopStateEvent('popstate', {state: null})); await wait(20);
  check('Zurück-Taste fragt nach', !d.querySelector('#f-leave').hidden && !d.querySelector('#v-form').hidden);
  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
