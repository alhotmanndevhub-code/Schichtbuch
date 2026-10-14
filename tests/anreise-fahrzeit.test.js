// Test Version 1.2.0: Anreise/Abreise mit Fahrzeit
const {JSDOM} = require('jsdom'); const fs = require('fs'); const ExcelJS = require('exceljs');
const H = require('./helpers');
const DIR = H.ROOT + '/';
const html = fs.readFileSync(DIR + 'index.html', 'utf8');
const excelSrc = fs.readFileSync(DIR + 'exceljs.min.js', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
// Alter Stand: ein „Reisetag“ aus Version 1.0
const store = {[KEY]: JSON.stringify({version: 3, settings: {name: 'Freund'}, lastBackup: H.nowIso(),
  entries: {r1: {id: 'r1', date: '2026-10-04', year: 2026, type: 'reise', away: 'an', depart: '14:00', meals: {}, updated: '2026-10-04T20:00:00Z'},
            r2: {id: 'r2', date: '2026-10-09', year: 2026, type: 'reise', away: 'ab', ret: '18:00', meals: {}, updated: '2026-10-09T20:00:00Z'}},
  expenses: {}})};
const saved = [];
function boot() {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) { H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = v}});
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
const data = () => JSON.parse(store[KEY]);
const byDate = dt => Object.values(data().entries).filter(e => e.date === dt);
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' ? ' | ' + info : '')); };
(async () => {
  let dom = boot(), w = dom.window, d = w.document; await wait(50);
  const $ = s => d.querySelector(s);
  const openNew = date => { const b = d.createElement('button'); b.dataset.new = date; $('#v-list').appendChild(b); b.click(); b.remove(); };
  const openId = id => { const b = d.createElement('button'); b.dataset.id = id; $('#v-list').appendChild(b); b.click(); b.remove(); };
  const save = async () => { $('#f-save').click(); await wait(20); };
  const pressed = g => [...d.querySelectorAll(g + ' [aria-pressed="true"]')].map(b => b.dataset.v).join(',');

  // 1 Alte Reisetage werden übernommen
  const lt = T($('#v-list').textContent);
  check('Alter Reisetag -> Anreise/Abreise in der Liste', lt.includes('So04') || lt.includes('So 04'), '');
  openId('r1');
  check('Alter Reisetag (an) öffnet als Anreise', pressed('#g-type') === 'anreise' && pressed('#g-away') === 'an', pressed('#g-type') + '/' + pressed('#g-away'));
  $('#f-back').click(); await wait(10);
  openId('r2');
  check('Alter Reisetag (ab) öffnet als Abreise', pressed('#g-type') === 'abreise' && pressed('#g-away') === 'ab', pressed('#g-type') + '/' + pressed('#g-away'));
  $('#f-back').click(); await wait(10);

  // 2 Sonntag Anreise mit 5 Std. Fahrzeit
  openNew('2026-10-18');
  $('#f-clear').click();
  $('#g-type [data-v="anreise"]').click();
  check('Anreise: Arbeitszeit ausgeblendet', $('#b-time').hidden);
  check('Anreise: Fahrzeit-Feld sichtbar', !$('#b-travel').hidden && $('#l-travel').textContent === 'Stunden für die Anfahrt', $('#l-travel').textContent);
  check('Anreise: Auswärts = Anreise, Auslöse 21', pressed('#g-away') === 'an' && $('#f-allowance').value === '21,00', pressed('#g-away') + ' ' + $('#f-allowance').value);
  check('Anreise: Mehrere-Tage-Block ausgeblendet', $('#b-multi').hidden);
  inp(w, $('#f-travel'), '5');
  inp(w, $('#f-place'), 'Hamm (Westf)');
  await save();
  const so = byDate('2026-10-18')[0];
  check('Anreise gespeichert', so && so.type === 'anreise' && so.away === 'an' && so.travelMin === 300 && so.allowance === 21, JSON.stringify(so && {t: so.type, a: so.away, m: so.travelMin, al: so.allowance}));
  const row = [...d.querySelectorAll('#v-list .row')].find(r => r.textContent.includes('18'));
  check('Liste: Anreise einmal, Fahrt 5 h, rechts 5 h', row && T(row.textContent).includes('AnreiseFahrt 5 h') && !/Anreise.*Anreise/i.test(T(row.querySelector('.l1').textContent)) && T(row.querySelector('.hrs').textContent) === '5 h', row && T(row.textContent));

  // 3 Montagewoche Mo–Fr nach der Anreise am Sonntag
  openNew('2026-10-19');
  check('Montag nach Anreise: Vorschlag ganzer Tag', pressed('#g-away') === 'voll', pressed('#g-away'));
  $('#g-shift [data-v="frueh"]').click();
  check('Ganzer Tag: kein Fahrzeit-Feld', $('#b-travel').hidden);
  $('#b-multi').open = true; $('#b-multi').dispatchEvent(new w.Event('toggle'));
  inp(w, $('#m-until'), '2026-10-23'); $('#m-montage').checked = true; $('#m-montage').dispatchEvent(new w.Event('input'));
  check('Hinweis: Montag zählt als ganzer Tag', T($('#m-info').textContent).includes('Am So 18.10. bist du schon auf Montage eingetragen, deshalb zählt Mo 19.10. als 24 Std. auswärts.'), T($('#m-info').textContent));
  await save();
  const wk = ['19', '20', '21', '22', '23'].map(x => byDate('2026-10-' + x)[0]);
  check('Montagewoche: voll×4, ab', wk.map(e => e.away).join(',') === 'voll,voll,voll,voll,ab', wk.map(e => e.away).join(','));
  check('Montagewoche: Auslöse', wk.map(e => e.allowance).join(',') === '42,42,42,42,21', wk.map(e => e.allowance).join(','));

  // 4 Freitag: Arbeit + Heimfahrt 4:30
  openId(wk[4].id);
  check('Freitag Arbeit + Abreise: Fahrzeit-Feld da', !$('#b-time').hidden && !$('#b-travel').hidden && $('#l-travel').textContent === 'Stunden für die Heimfahrt', $('#l-travel').textContent);
  inp(w, $('#f-travel'), '4:30');
  await save();
  check('Freitag gespeichert mit 4,5 Std.', byDate('2026-10-23')[0].travelMin === 270, byDate('2026-10-23')[0].travelMin);
  openId(wk[4].id);
  check('Freitag: Feld zeigt 4,5', $('#f-travel').value === '4,5', $('#f-travel').value);
  $('#f-back').click(); await wait(10);

  // 5 Eingabeformate und Grenzen
  openNew('2026-10-25'); $('#f-clear').click(); $('#g-type [data-v="abreise"]').click();
  check('Abreise: Auswärts = Abreise', pressed('#g-away') === 'ab', pressed('#g-away'));
  inp(w, $('#f-travel'), '30');
  await save();
  check('Mehr als 24 Std. wird auf 24 begrenzt', byDate('2026-10-25')[0].travelMin === 1440, byDate('2026-10-25')[0].travelMin);
  // Anreise auf Urlaub umstellen -> Fahrzeit weg
  openId(byDate('2026-10-25')[0].id); $('#g-type [data-v="urlaub"]').click();
  check('Urlaub: Fahrzeit-Feld weg', $('#b-travel').hidden);
  await save();
  check('Urlaub: Fahrzeit gelöscht', byDate('2026-10-25')[0].travelMin === 0, byDate('2026-10-25')[0].travelMin);
  // Arbeitstag mit Fahrzeit, dann auf "Ganzer Tag" -> Fahrzeit wird beim Speichern verworfen
  openNew('2026-10-26'); $('#f-clear').click(); $('#g-away [data-v="an"]').click(); inp(w, $('#f-travel'), '2,5');
  inp(w, $('#f-start'), '07:00'); inp(w, $('#f-end'), '15:00');
  $('#g-away [data-v="voll"]').click();
  await save();
  check('Ganzer Tag: keine Fahrzeit gespeichert', byDate('2026-10-26')[0].travelMin === 0, byDate('2026-10-26')[0].travelMin);

  // 6 Auswertung
  $('[data-view="stats"]').click(); await wait(10);
  const ks = [...d.querySelectorAll('.kpi')].map(k => T(k.textContent));
  // Arbeitszeit: 5 Tage Früh 05:00–13:30 minus 30 = 8h -> 40h, plus 26.10. 07–15 minus 30 = 7,5h => 47,5h; Fahrzeit 5 + 4,5 = 9,5h => 57h
  check('Auswertung: Stunden mit Fahrzeit', ks.includes('57Stunden'), ks.join(' | '));
  check('Auswertung: Fahrzeit-Kachel', ks.some(k => k.startsWith('9,5Std. Fahrzeit')), ks.join(' | '));
  check('Auswertung: Monatszeile', T($('#v-stats').textContent).includes('Arbeitszeit 47,5 h · Fahrzeit 9,5 h'), T($('#v-stats .mtab').parentElement.textContent).slice(-140));
  $('[data-view="list"]').click(); await wait(10);
  check('Liste: Monatskopf', T($('.mhead span').textContent).startsWith('6 Tage · 57 h'), T($('.mhead span').textContent));

  // 7 Excel
  $('[data-view="more"]').click(); $('#x-xlsx').click(); await wait(1500);
  const x = saved.find(s => s.name.endsWith('.xlsx'));
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await read(w, x.blob));
  const en = wb.getWorksheet('Einträge'); const eh = en.getRow(1).values.slice(1);
  const fz = eh.indexOf('Fahrzeit (Std.)') + 1, sg = eh.indexOf('Stunden gesamt') + 1, ta = eh.indexOf('Tagesart') + 1;
  let sumRow = null; en.eachRow(r => { if (r.getCell(1).value === 'Summe') sumRow = r; });
  check('Excel Einträge: Summen Fahrzeit / gesamt', sumRow && sumRow.getCell(fz).value.result === 9.5 && sumRow.getCell(sg).value.result === 57, sumRow && JSON.stringify([sumRow.getCell(fz).value, sumRow.getCell(sg).value]));
  const types = []; en.eachRow((r, i) => { if (i > 1 && r.getCell(ta).value) types.push(r.getCell(ta).value); });
  check('Excel Einträge: Tagesart Anreise/Abreise', types.includes('Anreise') && types.includes('Abreise') && !types.includes('Reisetag'), types.join(','));
  // Formeln zeigen auf die richtigen Spalten
  const vf = sumRow.getCell(eh.indexOf('Verpflegung (€)') + 1).value, af = sumRow.getCell(eh.indexOf('Auslöse / Spesen vom AG (€)') + 1).value;
  check('Excel Einträge: Formeln in richtigen Spalten', vf.formula.startsWith('SUM(' + String.fromCharCode(64 + eh.indexOf('Verpflegung (€)') + 1)) && af.formula.includes(':' + (eh.indexOf('Auslöse / Spesen vom AG (€)') >= 26 ? 'A' : '')), vf.formula + ' / ' + af.formula);
  const ov = wb.getWorksheet('Übersicht'); const o = {}; ov.eachRow(r => { o[r.getCell(1).value && r.getCell(1).value.toString()] = r.getCell(2).value; });
  check('Excel Übersicht: Stunden', o['Arbeitsstunden'] === 47.5 && o['Fahrstunden (An- und Abreise)'] === 9.5 && o['Stunden gesamt'] === 57, JSON.stringify([o['Arbeitsstunden'], o['Fahrstunden (An- und Abreise)'], o['Stunden gesamt']]));
  const mo = wb.getWorksheet('Monate'); const mh = mo.getRow(1).values.slice(1);
  const okt = mo.getRow(11);
  check('Excel Monate: Oktober Fahrstunden / gesamt', okt.getCell(mh.indexOf('Fahrstunden') + 1).value === 9.5 && okt.getCell(mh.indexOf('Stunden gesamt') + 1).value === 57, '');
  // Summenzeile Monate: jede Formel summiert die eigene Spalte
  const ms = mo.getRow(14); let okF = true;
  for (let c = 2; c <= mh.length; c++) { const v = ms.getCell(c).value; const L = c <= 26 ? String.fromCharCode(64 + c) : 'A' + String.fromCharCode(64 + c - 26); if (!v || v.formula !== `SUM(${L}2:${L}13)`) okF = false; }
  check('Excel Monate: alle Summenformeln passen', okF);

  // 8 Sicherung hin und zurück
  $('#x-backup').click(); await wait(50);
  const b = saved.find(s => s.name.endsWith('.json')); const bj = JSON.parse((await read(w, b.blob)).toString());
  check('Sicherung enthält Fahrzeit', bj.entries.some(e => e.travelMin === 300) && bj.entries.some(e => e.type === 'anreise'));
  for (const k of Object.keys(store)) delete store[k];
  dom.window.close(); dom = boot(); w = dom.window; d = w.document; await wait(50);
  const file = new w.File([JSON.stringify(bj)], 's.json', {type: 'application/json'});
  const fi = d.querySelector('#x-restore'); Object.defineProperty(fi, 'files', {value: [file], configurable: true}); fi.dispatchEvent(new w.Event('change'));
  await wait(100);
  check('Sicherung geladen mit Fahrzeit', byDate('2026-10-18')[0] && byDate('2026-10-18')[0].travelMin === 300 && byDate('2026-10-23')[0].travelMin === 270, d.querySelector('#b-status').textContent);

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
