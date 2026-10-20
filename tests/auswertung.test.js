// Test Version 2.4.0: Auswertung „Arbeit“ (Monat wie auf der Lohnabrechnung, Monatsnachweis) und „Steuer“ (klare Antwort zuerst),
// „Dieser Monat“ auf der Startseite, Auslöse statt Pauschale in Liste, Kalender und Tagesdetail.
// Beispiel wie beim Tester: Firma zahlt 42 € (24 Std.) und 21 € (An-/Abreise), Unterkunft zahlt die Firma, zwei Tagestouren ohne Auslöse.
const {JSDOM} = require('jsdom'); const fs = require('fs');
const H = require('./helpers');
const html = fs.readFileSync(H.ROOT + '/index.html', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
let store = {};
function boot() {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) { H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k]}});
      w.scrollTo = () => {}; w.print = () => {};
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const E = (id, date, o) => Object.assign({id, date, year: +date.slice(0, 4), type: 'arbeit', shift: 'tag', start: '07:00', end: '15:30', pause: 30, travelMin: 0, place: 'Fulda', line: '', project: 'Weichenumbau', away: 'none',
  depart: '', ret: '', meals: {}, lodging: 0, lodgingName: '', vehicle: '', trip: 'dienst', meet: '', km: 0, allowance: 0, otherCost: 0, otherNote: '', note: '', photos: [], updated: '2026-01-01T00:00:00Z'}, o);
const NIGHT = {shift: 'nacht', start: '22:00', end: '06:00', place: 'Hamm (Westf)', project: 'Gleiserneuerung', away: 'tag', depart: '21:00', ret: '07:00'};
const seed = (entries, settings) => {
  store = {}; const m = {}; entries.forEach(e => m[e.id] = e);
  store[KEY] = JSON.stringify({version: 4, entries: m, expenses: {}, lastBackup: H.nowIso(), seenVersion: '2.4.0',
    settings: Object.assign({profSeen: true, name: 'Kollege Muster', state: 'NW', ausOn: true, ausFull: 42, ausHalf: 21, ausDay: 0, lodgingBy: 'firma'}, settings || {})});
};
const OKT = [
  E('a1', '2026-10-05', {away: 'an', depart: '06:00', allowance: 21}),
  E('v1', '2026-10-06', {away: 'voll', allowance: 42}), E('v2', '2026-10-07', {away: 'voll', allowance: 42}),
  E('v3', '2026-10-08', {away: 'voll', allowance: 42}), E('v4', '2026-10-09', {away: 'voll', allowance: 42}),
  E('b1', '2026-10-10', {away: 'ab', ret: '18:00', allowance: 21}),
  E('t1', '2026-10-01', Object.assign({}, NIGHT, {allowance: 21})), E('t2', '2026-10-02', Object.assign({}, NIGHT, {allowance: 21})),
  E('t3', '2026-10-12', NIGHT), E('t4', '2026-10-13', NIGHT),
  E('k1', '2026-10-11', {type: 'krank', shift: '', start: '', end: '', place: '', project: ''})
];

(async () => {
  let dom, w, d, $;
  const start = async () => { if (dom) dom.window.close(); dom = boot(); w = dom.window; d = w.document; $ = s => d.querySelector(s); await wait(60); };
  const visible = id => !$('#v-' + id).hidden;
  const rows = sel => [...d.querySelectorAll(sel + ' .wr')].map(r => T(r.textContent));

  seed(OKT); await start();

  // ---------- A: Startseite ----------
  const mo = T($('#v-list .mo').textContent);
  check('Startseite: „Dieser Monat“ mit Tagen, Stunden und Auslöse', mo.startsWith('Dieser Monat · Oktober') && mo.includes('10Arbeitstage') && mo.includes('78 hStunden') && mo.includes('252 €Auslöse'), mo);
  check('Startseite: keine Werbungskosten und kein Pauschbetrag', !/Werbungskosten|Pauschbetrag|Verpflegung/.test(T($('#v-list').textContent)));
  const r9 = [...d.querySelectorAll('#v-list .rows .row')].map(r => T(r.textContent)).find(t => t.includes('09.10.'));
  check('Liste: Auslöse statt Pauschale', r9 && r9.includes('8 h') && r9.includes('42 € Auslöse') && !r9.includes('28 €'), r9);
  check('Heute erfasst: Auslöse statt Verpflegung', T($('.today').textContent).startsWith('Heute erfasst') && !T($('.today').textContent).includes('Verpflegung'));

  // ---------- B: Auswertung „Arbeit“ ----------
  $('#v-list .mo').click(); await wait(10);
  const work = () => $('#stats-body [data-panel="work"]');
  check('„Dieser Monat“ öffnet „Arbeit“ für Oktober 2026', visible('stats') && !work().hidden && $('#stats-body [data-panel="tax"]').hidden && T($('#stats-body .wm h3').textContent) === 'Oktober 2026'
    && $('[data-stab="work"]').getAttribute('aria-selected') === 'true');
  const big = T($('#stats-body .wbig').textContent), az = rows('#stats-body .wcard:nth-of-type(1)');
  check('Arbeitszeit: 10 Tage, 78 Stunden, davon 30 h nachts', big === '10Arbeitstage78 hStunden' && T(work().textContent).includes('davon nachts (20 bis 6 Uhr)30 h'), big);
  const mt = [...d.querySelectorAll('#stats-body .wcard')].find(c => T(c.querySelector('h3').textContent) === 'Montage und Auslöse');
  const mr = mt ? [...mt.querySelectorAll('.wr')].map(r => T(r.textContent)) : [];
  check('Montage nach Art und Betrag wie auf der Lohnabrechnung', mr[0] === '4 × 24 Std. auswärts à 42 €168 €' && mr[1] === '2 × An- und Abreise à 21 €42 €' && mr[2] === '2 × Tagestour à 21 €42 €', mr.join(' | '));
  check('Tagestouren ohne Auslöse: gelb „prüfen“', mr[3] === '2 × Tagestour ohne Auslöseprüfen' && !!mt.querySelector('.lamp.open') && T(mt.textContent).includes('Hier fehlt die Auslöse'), mr[3]);
  check('Summe Auslöse 252 €', mr[4] === 'Auslöse laut deinen Einträgen252 €', mr[4]);
  const sonst = [...d.querySelectorAll('#stats-body .wcard')].find(c => T(c.querySelector('h3').textContent) === 'Sonst im Monat');
  check('Sonst im Monat: Übernachtungen zahlt die Firma, 1 Tag krank', sonst && T(sonst.textContent).includes('Übernachtungen5, zahlt die Firma') && T(sonst.textContent).includes('Krank1 Tag'), sonst && T(sonst.textContent));
  check('Monat ohne Steuerwörter', ![...d.querySelectorAll('#stats-body .wcard')].some(c => /Pauschale|Werbungskosten|Verpflegung|Finanzamt/.test(c.textContent)));
  check('Darunter das ganze Jahr', T(work().textContent).includes('Das ganze Jahr 2026') && !!work().querySelector('.mtab') && T(work().querySelector('.mtab').textContent).includes('Auslöse'));
  $('[data-wm="-1"]').click(); await wait(10);
  check('Monat zurück: September ohne Einträge', T($('#stats-body .wm h3').textContent) === 'September 2026' && T(work().textContent).includes('Für September 2026 gibt es noch keine Einträge'));
  $('[data-wm="1"]').click(); await wait(10);

  // ---------- C: Monatsnachweis ----------
  $('[data-report="month"]').click(); await wait(20);
  const paper = T($('#r-paper').textContent);
  check('Monatsnachweis: eigener Titel, ohne „alle Tage“-Schalter', visible('report') && T($('#r-title').textContent) === 'Monatsnachweis' && $('#r-days-w').hidden && $('#r-photos-w').hidden);
  check('Monatsnachweis: Kopf mit Name und Monat', paper.includes('Arbeitsnachweis Oktober 2026') && paper.includes('Kollege Muster'));
  const tr = [...d.querySelectorAll('#r-paper table.days tbody tr')].map(r => [...r.querySelectorAll('td')].map(c => T(c.textContent)));
  const sumRow = tr[tr.length - 1];
  check('Monatsnachweis: alle 11 Tage und die Summe', tr.length === 12 && sumRow[0] === 'Summe' && sumRow[1] === '78' && sumRow[2] === '252 €', JSON.stringify(sumRow));
  check('Monatsnachweis: Zeile mit Zeit, Pause, Ort und Auslöse', tr.some(r => r[0] === 'Di 06.10.' && r[1].includes('Tagschicht · 07:00–15:30, Pause 30 Min. · Auswärts') && r[2] === 'Fulda' && r[3] === '8' && r[4] === '42 €'), JSON.stringify(tr[1]));
  check('Monatsnachweis: Summen mit Nachtstunden und Montage', paper.includes('davon nachts (20 bis 6 Uhr)30 h') && paper.includes('4 × 24 Std. auswärts à 42 €168 €') && paper.includes('Auslöse laut Einträgen252 €'));
  $('#r-back').click(); await wait(20);
  check('Zurück: wieder Auswertung', visible('stats'));
  $('[data-view="more"]').click(); $('#x-report').click(); await wait(20);
  check('Jahresbericht bleibt Jahresbericht', T($('#r-title').textContent) === 'Jahresbericht' && !$('#r-days-w').hidden && T($('#r-paper').textContent).includes('Jahresbericht 2026'));
  $('#r-back').click(); await wait(20);

  // ---------- D: Auswertung „Steuer“ ----------
  $('[data-view="stats"]').click(); $('[data-stab="tax"]').click(); await wait(10);
  const tax = $('#stats-body [data-panel="tax"]');
  check('Steuer: zuerst die Antwort', !tax.hidden && T($('.tq h3').textContent) === 'Bisher nichts extra' && T($('.tq').textContent).includes('Deine Kosten für die Arbeit (28,00 €) liegen unter 1.230 €'), T($('.tq').textContent).slice(0, 120));
  const st = T($('.sumtable').textContent);
  check('Steuer: Verpflegung in drei Zeilen', st.includes('Verpflegung, die erlaubt ist196,00 €') && st.includes('davon hat die Firma steuerfrei gezahlt− 168,00 €') && st.includes('bleibt28,00 €') && st.includes('Werbungskosten 202628,00 €'), st);
  check('Steuer: Übernachtung zahlt die Firma', st.includes('Übernachtung, zahlt die Firma0,00 €'));
  check('Steuer: Firma zahlt mehr als erlaubt', T(tax.textContent).includes('Deine Firma zahlt mehr, als steuerfrei erlaubt ist: 42 € statt 28 €, 21 € statt 14 €.'));
  check('Steuer: Hinweis auf fehlende Auslöse', T(tax.querySelector('.snote').textContent).startsWith('Bei 2 Tagen fehlt die Auslöse (Tagestour). Zahlt deine Firma dafür etwas?') && !!tax.querySelector('.snote [data-go="settings"]'));
  check('Steuer: Ausfüllhilfe, Zeile 20 und Einzelbeträge eingeklappt', ['anl', 'nr20', 'detail', 'how'].every(k => tax.querySelector(`details[data-keep="${k}"]`) && !tax.querySelector(`details[data-keep="${k}"]`).open)
    && T(tax.querySelector('[data-keep="detail"]').textContent).includes('abzüglich steuerfreie Auslöse für Verpflegung− 168,00 €'));
  tax.querySelector('[data-keep="anl"]').open = true;
  const nr = $('#st-nr20'); nr.value = '150'; nr.dispatchEvent(new w.Event('change', {bubbles: true})); await wait(10);
  check('Nach Zeile 20: aufgeklappte Ausfüllhilfe bleibt offen, Zeile 20 offen', $('[data-keep="anl"]').open && $('[data-keep="nr20"]').open && T($('.sumtable').textContent).includes('davon steuerfrei laut Zeile 20− 150,00 €'), T($('.sumtable').textContent));

  // ---------- E: Kalender und Tagesdetail ----------
  $('[data-view="cal"]').click(); $('[data-cal-day="2026-10-06"]').click(); await wait(10);
  const it = T($('#v-cal .daylist').textContent);
  check('Kalender: Auslöse statt „Verpfl.“', it.includes('42 € Auslöse') && !it.includes('Verpfl.'), it);
  $('#v-cal .item[data-day="2026-10-06"]').click(); await wait(10);
  const day = T($('#v-day').textContent);
  check('Tagesdetail: Auslöse, keine Verpflegungspauschale', day.includes('Auslöse42,00 €') && !day.includes('Verpflegungspauschale'), day.slice(0, 160));
  $('[data-view="all"][data-listmode="days"]').click(); await wait(10);
  check('Alle Einträge: Monatskopf mit Auslöse', T($('#v-all .mhead span').textContent) === '10 Tage · 78 h · 252 € Auslöse', T($('#v-all .mhead span').textContent));

  // ---------- F: ohne Auslöse in „Deine Arbeit“ ----------
  seed([E('x1', '2026-10-12', {away: 'tag', depart: '06:00', ret: '17:00'})], {ausOn: false, ausFull: 0, ausHalf: 0});
  await start();
  const mo2 = T($('#v-list .mo').textContent);
  check('Ohne Auslöse: „Dieser Monat“ zeigt Tage auswärts', mo2.includes('1Tage auswärts') && !mo2.includes('Auslöse'), mo2);
  $('[data-view="stats"]').click(); await wait(10);
  const mt2 = T($('#stats-body [data-panel="work"]').textContent);
  check('Ohne Auslöse: nur die Montagetage, kein „prüfen“ und keine 0 €', mt2.includes('MontageTagestour1 Tag') && !mt2.includes('prüfen') && !mt2.includes('ohne Auslöse') && !mt2.includes('0 €'), mt2.slice(0, 200));

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
