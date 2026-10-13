// Test Version 1.3.0: Ausfallschicht und Auslöse
const {JSDOM} = require('jsdom'); const fs = require('fs'); const ExcelJS = require('exceljs');
const H = require('./helpers');
const DIR = H.ROOT + '/';
const html = fs.readFileSync(DIR + 'index.html', 'utf8');
const excelSrc = fs.readFileSync(DIR + 'exceljs.min.js', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
// Alter Stand wie beim Freund: Einstellungen ohne Auslöse, ein Anreisetag ohne Auslöse
const store = {[KEY]: JSON.stringify({version: 3, settings: {name: 'Freund', pause: 30, rateSmall: 14, rateFull: 28},
  entries: {a1: {id: 'a1', date: '2026-10-04', year: 2026, type: 'reise', away: 'an', depart: '14:00', allowance: 0, meals: {}, updated: '2026-10-04T20:00:00Z'},
            a2: {id: 'a2', date: '2026-10-05', year: 2026, type: 'arbeit', shift: 'nacht', start: '22:00', end: '06:00', pause: 30, away: 'voll', place: 'Hamm', allowance: 0, meals: {}, updated: '2026-10-05T20:00:00Z'}},
  expenses: {}, lastBackup: H.nowIso()})};
const saved = [];
function boot() {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) { H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = v}});
      w.scrollTo = () => {}; w.eval(excelSrc);
      const blobs = {}; let n = 0;
      w.URL.createObjectURL = b => { const u = 'blob:x' + (++n); blobs[u] = b; return u; }; w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { saved.push({name: this.download, blob: blobs[this.href]}); };
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
const read = (w, blob) => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(Buffer.from(fr.result)); fr.readAsArrayBuffer(blob); });
const inp = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input')); };
const data = () => JSON.parse(store[KEY]);
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info ? ' | ' + info : '')); };
(async () => {
  let dom = boot(), w = dom.window, d = w.document; await wait(50);
  const $ = s => d.querySelector(s);
  const openNew = date => { const b = d.createElement('button'); b.dataset.new = date; $('#v-list').appendChild(b); b.click(); b.remove(); };
  const save = async () => { $('#f-save').click(); await wait(20); };

  // 1 Einstellungen: alte Daten ohne Auslöse bekommen 42 / 21
  $('#nav-settings').click();
  check('Einstellungen Auslöse vorbelegt', $('#s-aus-full').value === '42,00' && $('#s-aus-half').value === '21,00', $('#s-aus-full').value + ' / ' + $('#s-aus-half').value);
  $('[data-view="more"]').click();
  check('Version', $('#about-ver').textContent.includes('1.3.1'), $('#about-ver').textContent);

  // 2 Neuer Tag ohne Vorlage: Anreise antippen -> 21
  openNew('2026-10-11');
  $('#g-type [data-v="anreise"]').click();
  check('Reisetag setzt Anreise und 21 €', $('#f-allowance').value === '21,00', $('#f-allowance').value);
  check('Rechnung zeigt Pauschale und Auslöse', T($('#c-away').textContent).startsWith('Verpflegungspauschale 14,00 €Auslöse 21,00 €Für die Steuer bleiben von der Pauschale 0,00 €'), T($('#c-away').textContent));
  check('Hinweis Auswärts', T($('#h-away').textContent).includes('Pauschale fürs Finanzamt: 14 €. Auslöse der Firma: 21 €.'), T($('#h-away').textContent));
  check('Hinweis Auslöse-Feld sichtbar', !$('#h-allow').hidden, T($('#h-allow').textContent));
  $('#g-away [data-v="voll"]').click();
  check('Ganzer Tag -> 42 €', $('#f-allowance').value === '42,00', $('#f-allowance').value);
  inp(w, $('#f-allowance'), '30');
  $('#g-away [data-v="ab"]').click();
  check('Selbst eingetragene 30 € bleiben', $('#f-allowance').value === '30', $('#f-allowance').value);
  inp(w, $('#f-allowance'), '');
  $('#g-away [data-v="ab"]').click();
  check('Leeres Feld + erneut antippen -> 21 €', $('#f-allowance').value === '21,00', $('#f-allowance').value);
  $('#g-away [data-v="none"]').click();
  check('Kein Auswärts -> 0', $('#f-allowance').value === '', JSON.stringify($('#f-allowance').value));
  $('#g-away [data-v="an"]').click();
  await save();
  const e11 = Object.values(data().entries).find(e => e.date === '2026-10-11');
  check('Gespeichert mit 21 €', e11 && e11.allowance === 21, e11 && e11.allowance);

  // 3 Folgetag mit Vorlage: alter Eintrag hatte 0 -> jetzt automatisch, nach Anreise "Ganzer Tag" -> 42
  openNew('2026-10-12');
  check('Vorlage nach Anreise: ganzer Tag 42 €', $('#f-allowance').value === '42,00' && $('#g-away [data-v="voll"]').getAttribute('aria-pressed') === 'true', $('#f-allowance').value);
  // Ausfallschicht
  $('#g-shift [data-v="ausfall"]').click();
  check('Ausfall: Hinweis sichtbar', !$('#h-shift').hidden);
  check('Ausfall: Zeiten bleiben', $('#f-start').value === '22:00' && $('#f-end').value === '06:00', $('#f-start').value + '–' + $('#f-end').value);
  inp(w, $('#f-start'), '22:00'); inp(w, $('#f-end'), '02:00'); $('#g-pause [data-v="0"]').click();
  check('Ausfall: bezahlte Stunden', T($('#c-work').textContent) === 'Bezahlt 4 hüber Mitternacht', T($('#c-work').textContent));
  check('Ausfall-Knopf bleibt gewählt nach Zeiteingabe', $('#g-shift [data-v="ausfall"]').getAttribute('aria-pressed') === 'true');
  await save();
  // zweite Ausfallschicht ohne Stunden
  openNew('2026-10-13');
  $('#g-shift [data-v="ausfall"]').click(); inp(w, $('#f-start'), ''); inp(w, $('#f-end'), '');
  check('Ausfall ohne Zeiten', T($('#c-work').textContent) === 'Ausfallschicht ohne Stunden', T($('#c-work').textContent));
  await save();
  // Nächster Tag nimmt nicht die Ausfallschicht als Vorlage
  openNew('2026-10-14');
  check('Vorlage überspringt Ausfallschicht', $('#g-shift [data-v="nacht"]').getAttribute('aria-pressed') === 'true', [...d.querySelectorAll('#g-shift [aria-pressed="true"]')].map(b => b.dataset.v).join());
  $('#f-back').click(); await wait(10); if (!$('#f-leave').hidden) { d.querySelector('[data-leave="drop"]').click(); await wait(10); }

  // 4 Mehrere Tage: Montage Mo 19.10. bis Fr 23.10.
  openNew('2026-10-19');
  $('#f-clear').click();
  $('#g-shift [data-v="frueh"]').click(); $('#g-away [data-v="an"]').click();
  $('#b-multi').open = true; $('#b-multi').dispatchEvent(new w.Event('toggle'));
  inp(w, $('#m-until'), '2026-10-23'); $('#m-montage').checked = true; $('#m-montage').dispatchEvent(new w.Event('input'));
  await save();
  const wk = Object.values(data().entries).filter(e => e.date >= '2026-10-19' && e.date <= '2026-10-23').sort((a, b) => a.date < b.date ? -1 : 1);
  check('Montagewoche Auslöse', wk.map(e => e.away + ':' + e.allowance).join(' ') === 'an:21 voll:42 voll:42 voll:42 ab:21', wk.map(e => e.away + ':' + e.allowance).join(' '));

  // 5 Liste und Auswertung
  $('[data-view="list"]').click(); await wait(10);
  check('Liste zeigt Ausfallschicht', T($('#v-list').textContent).includes('Ausfallschicht'));
  $('[data-view="stats"]').click(); await wait(10);
  const wide = $('.kpi.wide');
  check('Auswertung: Ausfall-Kachel', wide && T(wide.textContent) === '2Ausfallschichten, davon 4 Std. bezahlt (in den Stunden enthalten)', wide && T(wide.textContent));
  check('Auswertung: Monatszeile', T($('#v-stats').textContent).includes('Ausfallschichten 2'));
  const tt = T($('.ttable').textContent);
  // Auslöse: 21 (11.10.) + 42 (12.10.) + 21+42+42+42+21 = 231; alte Einträge a1/a2 haben 0
  check('Auswertung: Auslöse abgezogen', tt.includes('abzüglich steuerfreie Auslöse für Verpflegung− 182,00 €'), tt.match(/abzüglich steuerfreie[^€]*€/));
  check('Auswertung: Auslöse erhalten / verrechnet', T($('#v-stats').textContent).includes('Auslöse und Spesen erhalten: 273,00 €. Davon mit Kosten verrechnet: 182,00 €.'));

  // 6 Excel
  $('[data-view="more"]').click(); $('#x-xlsx').click(); await wait(1500);
  const x = saved.find(s => s.name.endsWith('.xlsx'));
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await read(w, x.blob));
  const ov = wb.getWorksheet('Übersicht'); const ovRows = []; ov.eachRow(r => ovRows.push([r.getCell(1).value, r.getCell(2).value]));
  const ausRow = ovRows.find(r => r[0] === 'Ausfallschichten'), ausH = ovRows.find(r => String(r[0]).startsWith('davon bezahlte Stunden'));
  check('Excel Übersicht Ausfall', ausRow && ausRow[1] === 2 && ausH && ausH[1] === 4, JSON.stringify([ausRow, ausH]));
  const mo = wb.getWorksheet('Monate'); const hdr = mo.getRow(1).values.slice(1);
  const ci = hdr.indexOf('Ausfallschichten') + 1, ai = hdr.indexOf('Auslöse / Spesen vom AG (€)') + 1;
  const okt = mo.getRow(11), sum = mo.getRow(14);
  check('Excel Monate Oktober', okt.getCell(ci).value === 2 && okt.getCell(ai).value === 273, okt.getCell(ci).value + ' / ' + okt.getCell(ai).value);
  check('Excel Monate Summenformel', sum.getCell(ai).value && sum.getCell(ai).value.formula === `SUM(S2:S13)` && sum.getCell(ai).value.result === 273, JSON.stringify(sum.getCell(ai).value));
  const en = wb.getWorksheet('Einträge'); const eh = en.getRow(1).values.slice(1);
  const sCol = eh.indexOf('Schicht') + 1; const shifts = []; en.eachRow((r, i) => { if (i > 1) shifts.push(r.getCell(sCol).value); });
  check('Excel Einträge Schicht "Ausfall"', shifts.filter(v => v === 'Ausfall').length === 2, shifts.join(','));
  check('Excel Einträge Spaltenüberschrift', eh.includes('Auslöse / Spesen vom AG (€)'));

  // 7 Auslöse abschalten
  inp(w, $('#s-aus-full'), ''); inp(w, $('#s-aus-half'), '');
  $('#settings').dispatchEvent(new w.Event('submit', {cancelable: true})); await wait(10);
  check('Abgeschaltet gespeichert', data().settings.ausFull === 0 && data().settings.ausHalf === 0, JSON.stringify([data().settings.ausFull, data().settings.ausHalf]));
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50);
  const $$ = s => d.querySelector(s);
  $$('#nav-add').click(); inp(w, $$('#f-date'), '2026-11-02'); $$('#f-clear').click(); $$('#g-away [data-v="an"]').click();
  check('Ohne Auslöse: Feld leer, Hinweis aus', $$('#f-allowance').value === '' && $$('#h-allow').hidden && !T($$('#h-away').textContent).includes('Auslöse'), T($$('#h-away').textContent));
  check('Nach Neustart bleibt 0', $$('#s-aus-full').value === '' , JSON.stringify($$('#s-aus-full').value));

  // 8 Feld auf 20 setzen im Formular: Tag mit zwei Einsätzen -> zweiter bekommt keine doppelte Auslöse
  inp(w, $$('#s-aus-full'), '42'); inp(w, $$('#s-aus-half'), '21');
  $$('#settings').dispatchEvent(new w.Event('submit', {cancelable: true})); await wait(10);
  $$('#f-back').click(); await wait(10); if (!$$('#f-leave').hidden) { d.querySelector('[data-leave="drop"]').click(); await wait(10); }
  $$('#nav-add').click(); inp(w, $$('#f-date'), '2026-10-20'); $$('#f-clear').click(); $$('#g-away [data-v="voll"]').click();
  check('Zweiter Eintrag am selben Tag: keine doppelte Auslöse', $$('#f-allowance').value === '', JSON.stringify($$('#f-allowance').value));

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
