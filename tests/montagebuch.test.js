// Test Version 2.0.0 (MontageBuch): Name, Hell/Dunkel, Willkommen, Startseite, Kalender, Tagesdetail, Kopie, drei Schritte, Glocke, Auswertung in Reitern
const {JSDOM} = require('jsdom'); const fs = require('fs');
const H = require('./helpers');
const DIR = H.ROOT + '/';
const html = fs.readFileSync(DIR + 'index.html', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
let store = {};
function boot() {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) { H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k]}});
      w.scrollTo = () => {};
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
const data = () => JSON.parse(store[KEY]);
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const E = (id, date, o) => Object.assign({id, date, year: +date.slice(0, 4), type: 'arbeit', shift: '', start: '', end: '', pause: 0, travelMin: 0, place: '', line: '', project: '', away: 'none',
  depart: '', ret: '', meals: {}, lodging: 0, lodgingName: '', vehicle: '', trip: 'dienst', meet: '', km: 0, allowance: 0, otherCost: 0, otherNote: '', note: '', updated: '2026-01-01T00:00:00Z'}, o);
const seed = (entries, settings, extra) => {
  store = {}; const m = {}; entries.forEach(e => m[e.id] = e);
  store[KEY] = JSON.stringify(Object.assign({version: 4, entries: m, expenses: {}, lastBackup: H.nowIso(), seenVersion: '2.0.0',
    settings: Object.assign({ausFull: 0, ausHalf: 0, profSeen: true, name: 'Thomas Muster', state: 'NW'}, settings || {})}, extra || {}));
};

(async () => {
  let dom, w, d, $;
  const start = async () => { if (dom) dom.window.close(); dom = boot(); w = dom.window; d = w.document; $ = s => d.querySelector(s); await wait(60); };
  const visible = id => !$('#v-' + id).hidden;

  // ---------- A: Name und App-Daten ----------
  const man = JSON.parse(fs.readFileSync(DIR + 'manifest.webmanifest', 'utf8'));
  check('Manifest heißt MontageBuch, Kennung bleibt gleich', man.name === 'MontageBuch' && man.short_name === 'MontageBuch' && man.id === './' && man.start_url === './');
  store = {};
  await start();
  check('Titel MontageBuch', d.title === 'MontageBuch' && $('meta[name="apple-mobile-web-app-title"]').content === 'MontageBuch');
  check('Logo eingebettet (dunkel und hell)', !!$('#logo-d') && !!$('#logo-l') && d.querySelectorAll('symbol[id^="i-"]').length >= 30);

  // ---------- B: Hell und Dunkel ----------
  check('Standard: dunkel', d.documentElement.dataset.theme === 'dark');
  $('[data-theme-set="light"]').click();
  check('Hell gewählt und nur auf dem Gerät gemerkt', d.documentElement.dataset.theme === 'light' && store[KEY + '-theme'] === 'light' && !(store[KEY] || '').includes('"theme"'));
  check('Knopf „Hell“ gedrückt', $('[data-theme-set="light"]').getAttribute('aria-pressed') === 'true' && $('[data-theme-set="dark"]').getAttribute('aria-pressed') === 'false');
  await start();
  check('Nach Neustart hell (schon vor dem Laden gesetzt)', d.documentElement.dataset.theme === 'light' && $('meta[name="theme-color"]').content === '#F6F6F4');
  $('[data-theme-set="auto"]').click();
  check('Wie am Handy: ohne Angabe des Handys dunkel', d.documentElement.dataset.theme === 'dark' && store[KEY + '-theme'] === 'auto');
  $('[data-theme-set="dark"]').click();

  // ---------- C: Willkommen ----------
  store = {}; await start();
  check('Neuer Nutzer: Willkommen statt Startseite', visible('welcome') && !visible('list') && $('#tabs').hidden);
  $('[data-welcome="skip"]').click();
  check('Erst mal umsehen: Startseite', visible('list') && !$('#tabs').hidden && T($('#v-list').textContent).includes('Noch keine Einträge'));
  store = {}; await start();
  $('[data-welcome="start"]').click(); await wait(10);
  check('Los geht’s: Einstellungen, danach gilt als eingerichtet', visible('settings') && data().settings.profSeen === true);
  w.dispatchEvent(new w.PopStateEvent('popstate', {state: null})); await wait(10);
  check('Zurück: Startseite statt Willkommen', visible('list') && !visible('welcome'));
  seed([E('a', '2026-10-01', {shift: 'frueh', start: '05:00', end: '13:30'})], {profSeen: false});
  await start();
  check('Mit Daten: kein Willkommen', visible('list'));

  // ---------- D: Startseite ----------
  seed([
    E('a1', '2026-10-07', {shift: 'frueh', start: '05:00', end: '13:30', pause: 30, place: 'Hamm (Westf)', project: 'Gleiserneuerung', line: '2650, km 112,4'}),
    E('a2', '2026-10-08', {shift: 'frueh', start: '05:00', end: '13:30', pause: 30, place: 'Hamm (Westf)', project: 'Gleiserneuerung', line: '2650, km 112,4', away: 'tag', depart: '04:00', ret: '15:00', vehicle: 'pkw', km: 96})
  ]);
  await start();
  const home = T($('#v-list').textContent);
  check('Begrüßung mit Vorname und Datum', /(Guten Morgen|Guten Tag|Guten Abend|Hallo),Thomas!/.test(home) && home.includes('Dienstag, 13. Oktober 2026'), home.slice(0, 80));
  check('Diese Woche: 0 von 2 Werktagen', T($('.week .big').textContent) === '0 / 2', T($('.week .big').textContent));
  check('Fehlende Tage nachtragen', home.includes('2 Werktage ohne Eintrag (Fr 09.10. bis Mo 12.10.)') && !!$('.week [data-new="2026-10-09"]'));
  check('Aktueller Einsatz: Ort, Strecke, Zeitraum', T($('.job').textContent).includes('Hamm (Westf)') && T($('.job').textContent).includes('2650, km 112,4') && T($('.job').textContent).includes('Mi 07.10. – Do 08.10.'), T($('.job').textContent));
  check('Letzte Einträge mit Datum und Wochentag', T($('#v-list .rows').textContent).startsWith('Do08.10.'), T($('#v-list .rows').textContent).slice(0, 40));
  check('PC-Kacheln und Werbungskosten-Ring vorhanden', d.querySelectorAll('#v-list .kc').length === 4 && !!$('#v-list .donut circle[stroke-dasharray]'));
  $('[data-view="all"]').click(); await wait(10);
  check('Alle Einträge: eigene Seite mit Monaten', visible('all') && !!$('#v-all .mhead') && !$('#top-back').hidden && $('#top-title').textContent === 'Alle Einträge');
  $('#top-back').click(); await wait(20);
  check('Zurück-Knopf: wieder Start', visible('list'));

  // ---------- E: Fahrt erfassen öffnet Schritt 3 ----------
  $('[data-trip]').click();
  check('Fahrt erfassen: neuer Tag heute bei „Details“', visible('form') && $('#f-date').value === '2026-10-13' && !$('#v-form .step[data-step="3"]').hidden && $('#f-steps [data-step="3"]').getAttribute('aria-current') === 'step');
  check('Letzter Schritt: Speichern unten statt Weiter', !$('#f-save').hidden && $('#f-stepnext').hidden);

  // ---------- F: drei Schritte ----------
  $('#f-steps [data-step="1"]').click();
  check('Schritt 1: Datum und Tagesart', !$('#v-form .step[data-step="1"]').hidden && $('#v-form .step[data-step="2"]').hidden && $('#f-save').hidden && !$('#f-stepnext').hidden);
  $('#f-stepnext').click();
  check('Weiter: Schritt 2 mit Schicht und Auswärts', !$('#v-form .step[data-step="2"]').hidden && !$('#b-time').hidden);
  $('#f-stepback').click();
  $('#g-type [data-v="urlaub"]').click();
  check('Urlaub: Schritt 2 leer und gesperrt', $('#f-steps [data-step="2"]').disabled);
  $('#f-stepnext').click();
  check('Weiter springt zu Schritt 3', !$('#v-form .step[data-step="3"]').hidden);
  $('#f-steps [data-step="1"]').click();
  $('#f-quick').click(); await wait(20);
  check('Speichern oben geht bei jedem Schritt', Object.values(data().entries).some(e => e.date === '2026-10-13' && e.type === 'urlaub') && visible('list'));

  // ---------- G: Kalender und Tagesdetail ----------
  $('[data-view="cal"]').click(); await wait(10);
  check('Kalender: Oktober 2026, heute markiert', visible('cal') && T($('#v-cal .calhead h2').textContent) === 'Oktober 2026' && $('#v-cal .cday.today').dataset.calDay === '2026-10-13');
  check('Punkte: Arbeitstag, Reise und Frei', !!$('[data-cal-day="2026-10-08"] .k-work') && !!$('[data-cal-day="2026-10-13"] .k-off') && !$('[data-cal-day="2026-10-10"] i'));
  $('[data-cal-day="2026-10-08"]').click();
  const cal = T($('#v-cal').textContent);
  check('Tag gewählt: Schicht, Fahrt, neuer Eintrag', cal.includes('Do, 8. Oktober 2026') && cal.includes('Frühschicht05:00–13:30 · Hamm (Westf)') && cal.includes('Fahrt') && cal.includes('96 km') && !!$('#v-cal [data-new="2026-10-08"]'), cal.slice(-200));
  $('[data-cal-m="-1"]').click();
  check('Voriger Monat', T($('#v-cal .calhead h2').textContent) === 'September 2026');
  $('[data-cal-today]').click();
  $('[data-cal-day="2026-10-08"]').click();
  $('#v-cal .item[data-day="2026-10-08"]').click(); await wait(10);
  const day = T($('#v-day').textContent);
  check('Tagesdetail: Datum, auswärts, Zeit, Fahrt, Verpflegung', visible('day') && day.includes('Donnerstag, 8. Oktober 2026') && day.includes('Auswärtiger Einsatz') && day.includes('05:00 – 13:30 (8 h)') && day.includes('96 km gefahren') && /Verpflegungspauschale[^€]*14,00 €/.test(day), day.slice(0, 200));
  check('Tagesdetail: Unterseite mit Zurück, Kalender markiert', $('#top-title').textContent === 'Tagesdetail' && !$('#top-back').hidden && $('#tabs [data-view="cal"]').getAttribute('aria-current') === 'page');
  $('[data-day-step="1"]').click();
  check('Pfeil: nächster Tag', T($('#v-day .dhead').textContent).startsWith('Freitag, 9. Oktober 2026') && T($('#v-day').textContent).includes('Nichts eingetragen'));
  $('[data-day-step="-1"]').click();
  $('#v-day [data-copy="a2"]').click(); await wait(10);
  check('Kopie für nächsten Tag: 09.10. wie 08.10.', visible('form') && $('#f-date').value === '2026-10-09' && !$('#f-prefill').hidden && T($('#f-prefill-date').textContent) === 'am Do 08.10.' && $('#f-place').value === 'Hamm (Westf)' && $('#f-start').value === '05:00');
  $('#f-quick').click(); await wait(20);
  check('Nach dem Speichern: zurück im Tagesdetail des neuen Tags', visible('day') && T($('#v-day .dhead').textContent).startsWith('Freitag, 9. Oktober 2026') && Object.values(data().entries).filter(e => e.date === '2026-10-09').length === 1);
  $('#v-day [data-id]').click(); await wait(10);
  check('Stift öffnet den Eintrag', visible('form') && $('#f-date').value === '2026-10-09' && $('#f-title').textContent === 'Fr 09.10.');
  $('#f-back').click(); await wait(10);
  w.dispatchEvent(new w.PopStateEvent('popstate', {state: null})); await wait(10);
  check('Zurück-Taste im Tagesdetail: wieder Kalender', visible('cal'));

  // ---------- H: Glocke ----------
  seed([E('a1', '2026-10-07', {shift: 'frueh', start: '05:00', end: '13:30'})], {profSeen: false}, {seenVersion: '1.4.0'});
  await start();
  check('Glocke zählt Neuigkeiten und Einrichten', $('[data-bell] .badge').textContent === '2' && !$('[data-bell] .badge').hidden);
  $('[data-bell]').click();
  check('Glocke offen, Neuigkeiten 2.0.0', !$('#bell').hidden && T($('#bell-list .news b').textContent) === 'Neu in Version 2.0.0');
  $('#bell-list [data-news]').click(); await wait(10);
  check('Verstanden: Neuigkeit weg, Glocke bleibt offen für den Rest', !$('#bell-list .news') && !$('#bell').hidden && $('[data-bell] .badge').textContent === '1');
  $('#bell [data-bell-close].iconbtn').click(); await wait(20);
  check('Glocke schließen', $('#bell').hidden);
  check('Sicherung fehlt nie in der Glocke, sondern auf Start', !T($('#bell-list').textContent).includes('Datensicherung'));

  // ---------- I: Auswertung in Reitern ----------
  seed([E('n1', '2026-09-07', {type: 'anreise', away: 'an', depart: '12:00'}), E('n2', '2026-09-08', {shift: 'tag', start: '07:00', end: '15:30', pause: 30, away: 'voll'}),
    E('n3', '2026-09-09', {shift: 'tag', start: '07:00', end: '15:30', pause: 30, away: 'ab', ret: '19:00'}), E('o1', '2025-05-05', {shift: 'tag', start: '07:00', end: '15:30'})]);
  await start();
  $('[data-view="stats"]').click(); await wait(10);
  const panel = p => $('#stats-body [data-panel="' + p + '"]');
  check('Übersicht zuerst: Werbungskosten 56,00 €', !panel('over').hidden && panel('anl').hidden && panel('std').hidden && T($('.bigsum .amount').textContent) === '56,00 €');
  check('Aufteilung ergibt die Summe', T($('.sumtable').textContent).includes('Verpflegung56,00 €') && T($('.sumtable').textContent).includes('Fahrten0,00 €'));
  $('[data-stab="anl"]').click();
  check('Reiter Anlage N: Zeilen 73 und 74', !panel('anl').hidden && panel('over').hidden && T(panel('anl').textContent).includes('Zeile 73') && T(panel('anl').textContent).includes('Zeile 74'));
  $('[data-stab="std"]').click();
  check('Reiter Stunden: Kennzahlen und Monate', !panel('std').hidden && d.querySelectorAll('#stats-body .kpi').length >= 6 && !!$('#stats-body .mtab'));
  $('[data-view="list"]').click(); $('[data-view="stats"]').click(); await wait(10);
  check('Gewählter Reiter bleibt', !panel('std').hidden);
  $('#year').value = '2025'; $('#year').dispatchEvent(new w.Event('change')); await wait(10);
  check('Steuerjahr wechseln', T($('#stats-body').textContent).includes('Werbungskosten 2025') && $('#year-x').value === '2025' && $('#year').value === '2025');
  $('[data-view="more"]').click();
  check('Excel-Dateiname folgt dem Jahr', $('#x-name').value === 'MontageBuch_2025.xlsx');

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
