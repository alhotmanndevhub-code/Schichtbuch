// Test Version 2.5.0: Wochengleis mit Lichtpunkt und Lampentest, Montage als Leiste (Startseite und Auswertung > Arbeit),
// fehlende Auslöse mit einem Tipp eintragen (mit Rückgängig), Reparaturen (Einsatz-Karte am Handy, Farbe von „prüfen“)
const {JSDOM} = require('jsdom'); const fs = require('fs');
const H = require('./helpers');
const html = fs.readFileSync(H.ROOT + '/index.html', 'utf8');
const sw = fs.readFileSync(H.ROOT + '/sw.js', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
let store = {}, buzzes = [], anims = [];
// reduce: Handy will keine Bewegung. anim: Browser kann Animationen (Element.animate) und Flächen haben eine Größe,
// hold: die Animation läuft nicht zu Ende (Zustand mittendrin prüfen)
function boot(o = {}) {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) {
      H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k]}});
      if (o.reduce) w.matchMedia = q => ({matches: /prefers-reduced-motion:\s*reduce/.test(q), addEventListener() {}, removeEventListener() {}});
      if (o.anim) {
        w.Element.prototype.getBoundingClientRect = function () { const i = this.parentNode ? [...this.parentNode.children].indexOf(this) : 0; return {left: i * 40, top: 0, width: 40, height: 20, right: i * 40 + 40, bottom: 20}; };
        w.Element.prototype.animate = function (k) { anims.push(k); const a = {}; a.finished = o.hold ? new Promise(() => {}) : Promise.resolve(a); return a; };
      }
      Object.defineProperty(w.navigator, 'vibrate', {value: p => { buzzes.push(p); return true; }, configurable: true});
      w.scrollTo = () => {}; w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
const data = () => JSON.parse(store[KEY]);
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const E = (id, date, o) => Object.assign({id, date, year: +date.slice(0, 4), type: 'arbeit', shift: '', start: '', end: '', pause: 0, travelMin: 0, place: '', line: '', project: '', away: 'none',
  depart: '', ret: '', meals: {}, lodging: 0, lodgingName: '', vehicle: '', trip: 'dienst', meet: '', km: 0, allowance: 0, otherCost: 0, otherNote: '', note: '', photos: [], updated: '2026-01-01T00:00:00Z'}, o);
const seed = (entries, settings) => {
  store = {}; const m = {}; entries.forEach(e => m[e.id] = e);
  store[KEY] = JSON.stringify({version: 4, entries: m, expenses: {}, lastBackup: H.nowIso(), seenVersion: '2.5.0',
    settings: Object.assign({ausFull: 0, ausHalf: 0, profSeen: true, name: 'Thomas Muster', state: 'NW'}, settings || {})});
};
// Tagschicht in Leipzig; Firma zahlt 42 € für 24 Std. auswärts und 21 € für An- und Abreise
const W = {shift: 'tag', start: '06:00', end: '16:30', pause: 30, place: 'Leipzig Hbf', project: 'Gleiserneuerung'};
const AUS = {ausOn: true, ausFull: 42, ausHalf: 21, ausDay: 0};
const M = (id, date, away, allowance, o) => E(id, date, Object.assign({}, W, {away, allowance}, o));
// Montage Mo 5. bis Fr 9. Oktober, am Donnerstag fehlt die Auslöse
const LEIPZIG = [M('a1', '2026-10-05', 'an', 21), M('a2', '2026-10-06', 'voll', 42), M('a3', '2026-10-07', 'voll', 42), M('a4', '2026-10-08', 'voll', 0), M('a5', '2026-10-09', 'ab', 21)];

(async () => {
  let dom, w, d, $;
  const start = async o => { if (dom) dom.window.close(); buzzes = []; anims = []; dom = boot(o); w = dom.window; d = w.document; $ = s => d.querySelector(s); await wait(60); };
  const lamp = date => { const b = $(`.wd[data-day="${date}"] .lamp`); return b ? [...b.classList].filter(c => c !== 'lamp').join(' ') : '–'; };
  const sleeper = i => d.querySelectorAll('.wk-track i')[i].className;
  const cars = (sel = '.job') => [...d.querySelectorAll(sel + ' .mt-car')];
  const visible = id => !$('#v-' + id).hidden;

  // ---------- A: Lampentest beim ersten Öffnen ----------
  seed([E('m1', '2026-10-12', W)], AUS);
  await start();
  check('Erstes Öffnen: Lampen gehen nacheinander an', $('.wk').classList.contains('test') && $('.wd .lamp').getAttribute('style') === '--i:0' && d.querySelectorAll('.wk-track i')[6].getAttribute('style') === '--i:6');
  await wait(1200);
  check('Danach wieder normal (heute pulsiert)', !$('.wk').classList.contains('test') && lamp('2026-10-13') === 'open pulse');
  $('#tabs [data-view="cal"]').click(); await wait(10); $('#tabs [data-view="list"]').click(); await wait(10);
  check('Nur beim ersten Öffnen, nicht bei jedem Wechsel', !$('.wk').classList.contains('test'));

  // ---------- B: Lichtpunkt beim Speichern (Browser ohne Animationen: sofort an) ----------
  $('.today [data-quick]').click(); await wait(20);
  let days = $('.wk-days');
  check('Speichern: Lichtpunkt fährt von Montag zu heute', days.dataset.lt === '1' && days.dataset.lf === '0' && !!days.querySelector('.wk-light'), JSON.stringify(days.dataset));
  check('Ohne Animationen: Lampe und Schwelle sofort an', lamp('2026-10-13') === 'ok pop' && sleeper(1) === 'ok pop', lamp('2026-10-13') + ' / ' + sleeper(1));
  check('Woche damit komplett: die grünen Schwellen hüpfen danach', days.dataset.full === '1' && T($('.wk-h').textContent) === 'Diese WocheAlle 2 Werktage erfasst');
  check('Handy vibriert einmal', buzzes.length === 1, JSON.stringify(buzzes));

  // ---------- C: mit Animationen ----------
  seed([E('m1', '2026-10-12', W)], AUS);
  await start({anim: true, hold: true});
  $('.today [data-quick]').click(); await wait(20);
  check('Unterwegs: heute noch aus, Lichtpunkt sichtbar', lamp('2026-10-13') === 'ok arrive' && sleeper(1) === 'ok arrive' && !$('.wk-light').hidden && anims.length === 1, lamp('2026-10-13') + ' / ' + anims.length);
  seed([E('m1', '2026-10-12', W)], AUS);
  await start({anim: true});
  $('.today [data-quick]').click(); await wait(30);
  const path = anims.map(k => k[k.length - 1].transform).join(' | ');
  check('Angekommen: Lampe an, Punkt wieder weg', lamp('2026-10-13') === 'ok pop' && sleeper(1) === 'ok pop' && $('.wk-light').hidden && anims.length === 3, path);
  check('Weg: auftauchen bei Montag, fahren bis Dienstag, ausblenden', anims[0][1].transform.startsWith('translate(-20px, 10px)') && anims[1][1].transform.startsWith('translate(20px, 10px)') && /scale\(2\.6\)/.test(anims[2][1].transform), path);
  // ohne Eintrag davor in der Woche: Punkt kommt von links
  seed([E('f1', '2026-10-09', W)], AUS);
  await start();
  $('.today [data-quick]').click(); await wait(20);
  check('Erster Eintrag der Woche: Punkt kommt von links, Woche noch nicht komplett', $('.wk-days').dataset.lt === '1' && $('.wk-days').dataset.lf === '-1' && !$('.wk-days').dataset.full);

  // ---------- D: Ändern und „Bewegung reduzieren“ ----------
  seed([E('m1', '2026-10-12', W), E('t1', '2026-10-13', W)], AUS);
  await start();
  $('.today .td-plan').click(); await wait(10);
  $('#f-save').click(); await wait(20);
  check('Ändern eines Tages: kein Lichtpunkt, Lampe nur kurz hervorgehoben', visible('list') && !$('.wk-days').dataset.lt && !$('.wk-light') && lamp('2026-10-13') === 'ok pop');
  seed([E('m1', '2026-10-12', W)], AUS);
  await start({reduce: true});
  check('Bewegung reduziert: kein Lampentest', !$('.wk').classList.contains('test'));
  $('.today [data-quick]').click(); await wait(20);
  check('Bewegung reduziert: kein Lichtpunkt, Lampe gleich an', !$('.wk-days').dataset.lt && !$('.wk-light') && lamp('2026-10-13') === 'ok pop');
  check('Bewegung reduziert: Montage reiht sich nicht ein', !$('.mt.in'));

  // ---------- E: Montage als Leiste beim aktuellen Einsatz ----------
  seed(LEIPZIG, AUS);
  await start();
  let c = cars();
  check('Einsatz-Karte: fünf Tage als Leiste', c.length === 5 && T($('.job .jt b').textContent) === 'Leipzig Hbf', c.length);
  check('Vorne die Anreise (Lok), hinten die Abreise (Schlusslicht)', c[0].classList.contains('an') && c[4].classList.contains('ab') && !c[2].classList.contains('an') && !c[2].classList.contains('ab'));
  check('Auf jedem Feld Tag und Auslöse', c.map(x => T(x.textContent)).join(' | ') === 'Mo 5.21 € | Di 6.42 € | Mi 7.42 € | Do 8. | Fr 9.21 €', c.map(x => T(x.textContent)).join(' | '));
  check('Donnerstag gelb mit Lampe: Auslöse fehlt', c[3].classList.contains('chk') && !!c[3].querySelector('.lamp.open') && c[3].getAttribute('aria-label') === 'Donnerstag, 08.10.: 24 Std. auswärts, Auslöse fehlt', c[3].getAttribute('aria-label'));
  check('Darunter: Anreise, 3 × 24 Std. auswärts, Abreise', T($('.job .mt-l').textContent) === 'Anreise3 × 24 Std. auswärtsAbreise', T($('.job .mt-l').textContent));
  check('Summe der Montage neben dem Zeitraum', T($('.job .jd').textContent) === 'Mo 05.10. – Fr 09.10.126 € Auslöse', T($('.job .jd').textContent));
  check('Erstes Öffnen: die Tage reihen sich ein', $('.job .mt').classList.contains('in') && c[4].getAttribute('style') === '--i:4');
  c[3].click(); await wait(10);
  let det = () => T($('.job .mt-det') ? $('.job .mt-det').textContent : '');
  check('Tipp auf den gelben Tag: Angaben darunter', det().startsWith('Donnerstag, 08.10.24 Std. auswärts06:00 – 16:30 · Leipzig Hbf') && det().includes('Keine Auslöse eingetragen') && c[3].getAttribute('aria-pressed') === 'true', det());
  check('Mit Knopf „42 € eintragen“ und „Tag öffnen“', T($('.job [data-mtfix]').textContent) === '42 € eintragen' && $('.job [data-mtfix]').dataset.amount === '42' && T($('.job .mt-det [data-day]').textContent) === 'Tag öffnen');
  check('Leiste fährt beim Aufklappen nicht neu ein', cars().length === 5 && cars()[0] === c[0]);
  $('.job [data-mtfix]').click(); await wait(20);
  c = cars();
  check('Eingetragen: 42 € gespeichert', data().entries.a4.allowance === 42 && data().entries.a4.updated !== '2026-01-01T00:00:00Z');
  check('Feld jetzt normal mit 42 €', !c[3].classList.contains('chk') && T(c[3].textContent) === 'Do 8.42 €' && c[3].classList.contains('just'));
  check('Summe zählt von 126 € auf 168 €', $('.job .jsum b').dataset.from === '126' && $('.job .jsum b').dataset.count === '168');
  check('Angaben bleiben offen, jetzt mit Auslöse', det().includes('Auslöse42 €') && !det().includes('Keine Auslöse'), det());
  check('Meldung mit „Rückgängig“, Handy vibriert', T($('#toast').textContent).startsWith('42 € Auslöse eingetragen') && T($('#toast button').textContent) === 'Rückgängig' && buzzes.length === 1);
  await wait(900);
  check('Am Ende steht die neue Summe', T($('.job .jsum b').textContent) === '168 €', T($('.job .jsum b').textContent));
  $('#toast button').click(); await wait(20);
  check('Rückgängig: wieder ohne Auslöse', data().entries.a4.allowance === 0 && cars()[3].classList.contains('chk') && T($('#toast').textContent) === 'Rückgängig gemacht');
  cars()[1].click(); await wait(10);
  check('Anderer Tag: Auslöse 42 €', det().startsWith('Dienstag, 06.10.24 Std. auswärts') && det().includes('Auslöse42 €') && !$('.job [data-mtfix]') && cars()[3].getAttribute('aria-pressed') === 'false');
  cars()[1].click(); await wait(10);
  check('Nochmal tippen: zu', !$('.job .mt-det') && cars()[1].getAttribute('aria-pressed') === 'false');
  cars()[0].click(); await wait(10);
  $('.job .mt-det [data-day]').click(); await wait(10);
  check('„Tag öffnen“ zeigt das Tagesdetail', visible('day') && T($('#v-day .dhead').textContent).startsWith('Montag, 5. Oktober 2026'));

  // ---------- F: Auswertung > Arbeit ----------
  seed(LEIPZIG, AUS);
  await start();
  $('#tabs [data-view="stats"]').click(); await wait(10);
  const work = () => $('#stats-body [data-panel="work"]');
  let mts = [...work().querySelectorAll('.wcard .mt')];
  check('Arbeit: Montage als Leiste in „Montage und Auslöse“', mts.length === 1 && T(mts[0].closest('.wcard').querySelector('h3').textContent) === 'Montage und Auslöse' && cars('#stats-body').length === 5);
  check('Mit Ort und Zeitraum darüber', T(mts[0].querySelector('.mt-h').textContent) === 'Leipzig Hbf5. bis 9. Oktober', T(mts[0].querySelector('.mt-h').textContent));
  check('Zeilen darunter wie bisher', T(work().querySelector('.wcard .mts').nextElementSibling.textContent).startsWith('2 × 24 Std. auswärts à 42 €84 €1 × 24 Std. auswärts ohne Auslöse'), T(work().querySelector('.wcard .mts').nextElementSibling.textContent).slice(0, 60));
  cars('#stats-body')[3].click(); await wait(10);
  $('#stats-body [data-mtfix]').click(); await wait(20);
  check('Auch unter „Arbeit“ mit einem Tipp eintragen', data().entries.a4.allowance === 42 && !cars('#stats-body')[3].classList.contains('chk') && T(work().textContent).includes('Auslöse laut deinen Einträgen168 €'), T(work().textContent).slice(0, 120));

  // über den Monatswechsel: Tage aus dem anderen Monat blass
  seed([M('b1', '2026-09-30', 'an', 21), M('b2', '2026-10-01', 'voll', 42), M('b3', '2026-10-02', 'ab', 21)], AUS);
  await start();
  $('#tabs [data-view="stats"]').click(); await wait(10);
  c = cars('#stats-body');
  check('Oktober: Montage ab 30. September, der September-Tag blass', c.length === 3 && c[0].classList.contains('out') && !c[1].classList.contains('out') && T($('#stats-body .mt-h').textContent) === 'Leipzig Hbf30. September bis 2. Oktober', T($('#stats-body .mt-h').textContent));
  check('Kurze Montage: Felder nicht über die ganze Breite', $('#stats-body .mt').classList.contains('few') && $('#stats-body .mt').getAttribute('style') === '--n:3;--w:75%');
  $('#stats-body [data-wm="-1"]').click(); await wait(10);
  c = cars('#stats-body');
  check('September: dieselbe Montage, Oktober-Tage blass', c.length === 3 && !c[0].classList.contains('out') && c[1].classList.contains('out') && c[2].classList.contains('out'));

  // ---------- G: Sonderfälle ----------
  // Firma zahlt keine Auslöse: Tage mit Datum statt Betrag, nichts gelb, keine Summe
  seed(LEIPZIG.map(e => Object.assign({}, e, {allowance: 0})), {});
  await start();
  c = cars();
  check('Ohne Auslöse: Wochentag und Datum, nichts zu prüfen', c.map(x => T(x.textContent)).join(' ') === 'Mo5 Di6 Mi7 Do8 Fr9' && !d.querySelector('.mt-car.chk') && !$('.job .jsum'), c.map(x => T(x.textContent)).join(' '));
  $('#tabs [data-view="stats"]').click(); await wait(10);
  check('Ohne Auslöse unter „Arbeit“: Karte „Montage“ mit Leiste', [...d.querySelectorAll('#stats-body .wcard')].some(x => T(x.querySelector('h3').textContent) === 'Montage' && !!x.querySelector('.mt-bar')));
  // ein ganzer Tag fehlt mitten in der Montage: gestrichelte Lücke zum Nachtragen
  seed([M('g1', '2026-10-05', 'an', 21), M('g2', '2026-10-06', 'voll', 42), M('g4', '2026-10-08', 'voll', 42), M('g5', '2026-10-09', 'ab', 21)], AUS);
  await start();
  c = cars();
  check('Fehlender Tag: Lücke in der Leiste', c.length === 5 && c[2].classList.contains('gap') && c[2].dataset.new === '2026-10-07' && !!c[2].querySelector('.lamp.miss') && c[2].getAttribute('aria-label') === 'Mittwoch, 07.10.: Eintrag fehlt, nachtragen');
  check('Lücke zählt nicht als Tag', T($('.job .mt-l').textContent) === 'Anreise2 × 24 Std. auswärtsAbreise' && T($('.job .jsum').textContent) === '126 € Auslöse');
  c[2].click(); await wait(10);
  check('Tipp auf die Lücke: Formular für diesen Tag', visible('form') && $('#f-date').value === '2026-10-07');
  // Abreise beendet, Anreise beginnt: zwei Montagen hintereinander
  seed([M('h1', '2026-10-05', 'an', 21), M('h2', '2026-10-06', 'ab', 21), M('h3', '2026-10-07', 'an', 21), M('h4', '2026-10-08', 'ab', 21)], AUS);
  await start();
  $('#tabs [data-view="stats"]').click(); await wait(10);
  check('Abreise und neue Anreise: zwei Leisten', d.querySelectorAll('#stats-body .wcard .mt').length === 2);
  // zwei Einträge am selben Tag: die Auslöse steht beim zweiten, nichts gelb
  seed([M('k1', '2026-10-05', 'an', 21), M('k2', '2026-10-06', 'voll', 0, {start: '06:00', end: '10:00'}), M('k3', '2026-10-06', 'voll', 42, {start: '18:00', end: '22:00'}), M('k4', '2026-10-07', 'ab', 21)], AUS);
  await start();
  c = cars();
  check('Zwei Einträge an einem Tag: ein Feld mit der Auslöse', c.length === 3 && T(c[1].textContent) === 'Di 6.42 €' && !d.querySelector('.mt-car.chk'), c.map(x => T(x.textContent)).join(' | '));
  // Tagestour ist keine Montage mit Übernachtung
  seed([M('n1', '2026-10-08', 'tag', 0), M('n2', '2026-10-09', 'tag', 0)], AUS);
  await start();
  check('Nur Tagestouren: keine Leiste', !d.querySelector('.mt'));
  // neue Anreise nach einer abgeschlossenen Montage am selben Ort: Karte zeigt die neue Montage mit ihrem Zeitraum
  seed(LEIPZIG.concat([M('z1', '2026-10-12', 'an', 21)]), AUS);
  await start();
  check('Neue Montage: nur sie, mit eigenem Zeitraum und „läuft noch“', cars().length === 1 && T($('.job .jd').textContent) === 'Mo 12.10.21 € Auslöse' && T($('.job .mt-l').textContent) === 'Anreiseläuft noch' && $('.job .mt').classList.contains('few'), T($('.job .jd').textContent));
  // alte Montage (länger als eine Woche her) nicht mehr beim aktuellen Einsatz
  seed([M('o1', '2026-09-21', 'an', 21), M('o2', '2026-09-22', 'ab', 21), E('o3', '2026-10-01', W)], AUS);
  await start();
  check('Montage vor drei Wochen: nicht beim aktuellen Einsatz', !!$('.job') && !$('.job .mt'));

  // ---------- H: Reparaturen, Version ----------
  check('Einsatz-Karte hat am Handy wieder ihre Gestaltung', html.includes('.job-main{display:grid;') && html.includes('.job .jt{display:grid') && html.includes('.recent .sect .linkbtn{'));
  check('„prüfen“ wieder gelb: Farbe in Dunkel und Hell festgelegt', (html.match(/--amber-ink:#/g) || []).length === 2 && html.includes('.chk{color:var(--amber-ink)'));
  const ver = html.match(/APP_VERSION = '([^']+)'/)[1];
  // seit 2.5.1 prüft impressum.test.js die genaue Version, hier nur: mindestens 2.5.0 und überall gleich
  check('Version ab 2.5.0 in App und Offline-Speicher', ver.localeCompare('2.5.0', undefined, {numeric: true}) >= 0 && sw.includes(`const VERSION = '${ver}';`), ver);
  check('„Was ist neu“ nennt Lichtpunkt, Leiste und die Reparatur', /\['2\.5\.0', \['Wochengleis: [^']*Lichtpunkt/.test(html) && html.includes('Montage als Leiste') && html.includes('Repariert: Die Karte „Aktueller Einsatz“'));

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
