// Test Version 2.1.0: Startseite mit „Heute“ (ein Tipp wie gestern, Rückgängig), Woche als Gleis mit Signalen,
// Jahresbetrag mit Pauschbetrag, Rückgängig nach dem Löschen (mit Belegfoto), Bewegung und Rücksicht auf „Bewegung reduzieren“
const {JSDOM} = require('jsdom'); const fs = require('fs');
const {IDBFactory} = require('fake-indexeddb');
const H = require('./helpers');
const html = fs.readFileSync(H.ROOT + '/index.html', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
let store = {}, idb = null, buzzes = [];
// at: anderer Tag als die feste Testuhr (z. B. Sonntag), reduce: Handy will keine Bewegung
function boot(o = {}) {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) {
      if (o.at) { const NOW = Date.parse(o.at), Real = w.Date; w.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }; }
      else H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k]}});
      if (o.idb) Object.defineProperty(w, 'indexedDB', {value: idb, configurable: true});
      if (o.reduce) w.matchMedia = q => ({matches: /prefers-reduced-motion:\s*reduce/.test(q), addEventListener() {}, removeEventListener() {}});
      Object.defineProperty(w.navigator, 'vibrate', {value: p => { buzzes.push(p); return true; }, configurable: true});
      w.scrollTo = () => {}; w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
const data = () => JSON.parse(store[KEY]);
const eur = n => new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(n) + ' €';
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const E = (id, date, o) => Object.assign({id, date, year: +date.slice(0, 4), type: 'arbeit', shift: '', start: '', end: '', pause: 0, travelMin: 0, place: '', line: '', project: '', away: 'none',
  depart: '', ret: '', meals: {}, lodging: 0, lodgingName: '', vehicle: '', trip: 'dienst', meet: '', km: 0, allowance: 0, otherCost: 0, otherNote: '', note: '', photos: [], updated: '2026-01-01T00:00:00Z'}, o);
const X = (id, date, o) => Object.assign({id, date, year: +date.slice(0, 4), amount: 0, cat: 'sonst', text: '', note: '', photos: [], updated: '2026-01-01T00:00:00Z'}, o);
const seed = (entries, expenses, settings) => {
  store = {}; const m = {}, x = {}; entries.forEach(e => m[e.id] = e); (expenses || []).forEach(e => x[e.id] = e);
  store[KEY] = JSON.stringify({version: 4, entries: m, expenses: x, lastBackup: H.nowIso(), seenVersion: '2.1.0',
    settings: Object.assign({ausFull: 0, ausHalf: 0, profSeen: true, name: 'Thomas Muster', state: 'NW'}, settings || {})});
};
const idbDo = (mode, fn) => new Promise((res, rej) => {
  const rq = idb.open(KEY + '-belege', 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore('files', {keyPath: 'id'});
  rq.onsuccess = () => { const db = rq.result, tx = db.transaction('files', mode), r = fn(tx.objectStore('files')); tx.oncomplete = () => { db.close(); res(r && r.result); }; tx.onerror = rej; };
  rq.onerror = rej;
});
// Nachtschicht mit Tagestour und eigenem Auto (wie ein typischer Einsatz)
const NIGHT = {shift: 'nacht', start: '22:00', end: '06:00', pause: 30, place: 'Hamm (Westf)', project: 'Gleiserneuerung', line: '2650',
  away: 'tag', depart: '21:00', ret: '07:00', vehicle: 'pkw', km: 96};

(async () => {
  let dom, w, d, $;
  const start = async o => { if (dom) dom.window.close(); buzzes = []; dom = boot(o); w = dom.window; d = w.document; $ = s => d.querySelector(s); await wait(60); };
  const lamp = date => { const b = $(`.wd[data-day="${date}"] .lamp`); return b ? [...b.classList].filter(c => c !== 'lamp').join(' ') : '–'; };
  const visible = id => !$('#v-' + id).hidden;
  const today = () => Object.values(data().entries).filter(e => e.date === '2026-10-13');
  const strip = e => { const c = Object.assign({}, e); delete c.id; delete c.updated; return JSON.stringify(c); };

  // ---------- A: Heute mit einem Tipp ----------
  seed([E('f1', '2026-10-09', NIGHT), E('m1', '2026-10-12', NIGHT)]);
  await start();
  const hero = () => T($('.today').textContent);
  check('Heute noch offen, Vorschlag wie gestern', hero().startsWith('Heute noch offen') && hero().includes('Vorschlag wie gestern') && hero().includes('22:00 – 06:00') && hero().includes('Nachtschicht · 7,5 h · Tagestour') && hero().includes('Hamm (Westf) · Gleiserneuerung'), hero());
  check('Großer Knopf „Wie gestern übernehmen“', T($('.today [data-quick]').textContent) === 'Wie gestern übernehmen');
  check('Fahrt und Ausgabe gleich daneben', !!$('.today [data-trip]') && !!$('.today [data-newexp][data-date="2026-10-13"]'));
  check('Signal heute gelb, gestern grün', lamp('2026-10-13') === 'open pulse' && lamp('2026-10-12') === 'ok', lamp('2026-10-13') + ' / ' + lamp('2026-10-12'));
  const before = +$('#v-list [data-count]').dataset.count;
  $('.today [data-quick]').click(); await wait(20);
  const q = today();
  check('Ein Tipp: heute gespeichert wie gestern', q.length === 1 && q[0].shift === 'nacht' && q[0].start === '22:00' && q[0].place === 'Hamm (Westf)' && q[0].away === 'tag' && q[0].km === 96, JSON.stringify(q[0]));
  check('Karte zeigt „Heute erfasst“, Signal grün', hero().startsWith('Heute erfasst') && lamp('2026-10-13').startsWith('ok') && $('.today .lamp').classList.contains('pop'));
  check('Meldung mit „Rückgängig“', T($('#toast').textContent).startsWith('Heute gespeichert') && T($('#toast button').textContent) === 'Rückgängig');
  check('Handy vibriert kurz', buzzes.length === 1, JSON.stringify(buzzes));
  const cnt = $('#v-list [data-count]'), after = +cnt.dataset.count;
  check('Betrag zählt vom alten zum neuen Wert', cnt.dataset.from === String(before) && after > before && T($('#v-list .yr-d').textContent) === '+' + eur(after - before), `${before} → ${after}, ${T($('#v-list .yr-d').textContent)}`);
  await wait(900);
  check('Am Ende steht der neue Betrag', T(cnt.textContent) === eur(after), T(cnt.textContent));
  const quick = q[0];
  $('#toast button').click(); await wait(20);
  check('Rückgängig: Eintrag wieder weg', today().length === 0 && hero().startsWith('Heute noch offen') && T($('#toast').textContent) === 'Rückgängig gemacht');
  // derselbe Tag über das Formular: muss genau gleich aussehen wie mit einem Tipp
  $('.today .td-plan').click(); await wait(10);
  check('Tipp auf den Vorschlag öffnet das Formular für heute', visible('form') && $('#f-date').value === '2026-10-13' && $('#f-place').value === 'Hamm (Westf)');
  $('#f-save').click(); await wait(20);
  check('Ein Tipp speichert dasselbe wie das Formular', today().length === 1 && strip(today()[0]) === strip(quick), strip(today()[0]) + '\n' + strip(quick));
  check('Mit Eintrag: Karte öffnet ihn zum Ändern', !!$(`.today .td-plan[data-id="${today()[0].id}"]`) && T($('.today').textContent).includes('14 € Verpflegung'), T($('.today').textContent));

  // ---------- B: Woche als Gleis ----------
  seed([E('a1', '2026-10-07', NIGHT), E('a2', '2026-10-08', NIGHT)]);
  await start();
  check('Sieben Tage von Montag bis Sonntag', [...d.querySelectorAll('.wd')].map(b => b.dataset.day).join(',') === '2026-10-12,2026-10-13,2026-10-14,2026-10-15,2026-10-16,2026-10-17,2026-10-18');
  check('Gleis mit sieben Schwellen', d.querySelectorAll('.wk-track i').length === 7);
  check('Montag fehlt (rot), später grau', lamp('2026-10-12') === 'miss' && lamp('2026-10-14') === 'idle' && lamp('2026-10-17') === 'idle', lamp('2026-10-12'));
  check('Tage für Vorlesen beschriftet', $('.wd[data-day="2026-10-12"]').getAttribute('aria-label') === 'Montag, 12.10.: Eintrag fehlt' && $('.wd[data-day="2026-10-13"]').getAttribute('aria-label') === 'Dienstag, 13.10.: heute, noch nichts erfasst');
  check('Vorschlag älter als gestern: mit Wochentag', T($('.today [data-quick]').textContent) === 'Wie Donnerstag übernehmen' && hero().includes('Vorschlag wie am Donnerstag, 08.10.'), hero());
  $('.wd[data-day="2026-10-12"]').click(); await wait(10);
  check('Tipp auf einen Tag öffnet ihn', visible('day') && T($('#v-day .dhead').textContent).startsWith('Montag, 12. Oktober 2026'));
  // alles erfasst: grüner Satz
  seed([E('b1', '2026-10-12', NIGHT), E('b2', '2026-10-13', NIGHT)]);
  await start();
  check('Alle Werktage erfasst', T($('.wk-h').textContent) === 'Diese WocheAlle 2 Werktage erfasst' && !!$('.wk-h .all'));
  // Wochenende: kein gelbes Signal, Vorschlag mit Wochentag
  seed([E('c1', '2026-10-16', NIGHT)]);
  await start({at: '2026-10-18T10:00:00Z'});
  check('Sonntag: „Heute nichts erfasst“, grau statt gelb', hero().startsWith('Heute nichts erfasst') && lamp('2026-10-18') === 'idle' && T($('.today [data-quick]').textContent) === 'Wie Freitag übernehmen', hero().slice(0, 80));
  // ohne Vorlage: normaler Knopf
  seed([E('u1', '2026-10-12', {type: 'urlaub'})]);
  await start();
  check('Ohne Arbeitstag als Vorlage: „Arbeitstag erfassen“', !$('.today [data-quick]') && T($('.today [data-new]').textContent) === 'Arbeitstag erfassen');

  // ---------- C: Jahresbetrag mit Pauschbetrag ----------
  seed([E('y1', '2026-10-12', {shift: 'tag', start: '07:00', end: '15:30'})], [X('x1', '2026-03-02', {amount: 1500, cat: 'mittel'})]);
  await start();
  check('Über dem Pauschbetrag', T($('.yr-t').textContent) === '270,00 € mehr als der Pauschbetrag von 1.230 €' && $('#v-list [data-count]').dataset.count === '1500', T($('.yr-t').textContent));
  check('Grüner Teil nur über dem Pauschbetrag', $('.yr-bar .b').dataset.to !== 'scaleX(0.0000)' && /left:\s*71\.30%/.test($('.yr-bar b').getAttribute('style')), $('.yr-bar b').getAttribute('style'));
  seed([E('y1', '2026-10-12', {shift: 'tag', start: '07:00', end: '15:30'})], [X('x1', '2026-03-02', {amount: 1000, cat: 'mittel'})]);
  await start();
  check('Unter dem Pauschbetrag', T($('.yr-t').textContent) === 'Noch 230,00 € bis zum Pauschbetrag von 1.230 €, den es ohnehin gibt' && $('.yr-bar .b').dataset.to === 'scaleX(0.0000)', T($('.yr-t').textContent));
  seed([E('y1', '2026-10-12', {shift: 'tag', start: '07:00', end: '15:30'})], [X('x1', '2026-03-02', {amount: 1500, cat: 'mittel'}), X('x2', '2026-04-01', {amount: 300, cat: 'gew'})]);
  await start();
  check('Gewerkschaft zählt 2026 zusätzlich', T($('.yr-t').textContent) === '270,00 € mehr als der Pauschbetrag von 1.230 € (ohne Gewerkschaft)' && $('#v-list [data-count]').dataset.count === '1800', T($('.yr-t').textContent));
  $('.yr').click(); await wait(10);
  check('Tipp auf den Betrag: Auswertung', visible('stats'));

  // ---------- D: Rückgängig nach dem Löschen, mit Belegfoto ----------
  idb = new IDBFactory();
  await idbDo('readwrite', st => st.put({id: 'b1', type: 'image/jpeg', name: 'quittung.jpg', created: '', size: 3, buf: new Uint8Array([1, 2, 3]).buffer}));
  seed([E('p1', '2026-10-12', Object.assign({}, NIGHT, {photos: ['b1']}))]);
  await start({idb: true});
  const openId = id => { const b = d.createElement('button'); b.dataset.id = id; $('#v-list').appendChild(b); b.click(); b.remove(); };
  openId('p1'); await wait(20);
  $('#f-delete').click(); $('#f-delete').click(); await wait(80);
  check('Gelöscht, Foto auch', !data().entries.p1 && !(await idbDo('readonly', st => st.getAllKeys())).includes('b1'));
  check('Meldung „Eintrag gelöscht“ mit Rückgängig', T($('#toast').textContent).startsWith('Eintrag gelöscht') && T($('#toast button').textContent) === 'Rückgängig');
  $('#toast button').click(); await wait(80);
  check('Rückgängig: Eintrag und Foto wieder da', !!data().entries.p1 && data().entries.p1.photos[0] === 'b1' && (await idbDo('readonly', st => st.getAllKeys())).includes('b1') && T($('#toast').textContent) === 'Eintrag wiederhergestellt');
  check('Startseite zeigt den Tag wieder', T($('#v-list .rows').textContent).includes('1 Beleg'));

  // ---------- E: Bewegung ----------
  seed([E('m1', '2026-10-12', NIGHT)]);
  await start();
  $('#tabs [data-view="cal"]').click(); await wait(10);
  check('Bereich wechseln: Ansicht gleitet herein', $('#v-cal').classList.contains('v-in') && !$('#v-cal').classList.contains('fwd'));
  $('#v-cal [data-cal-day="2026-10-12"]').click(); $('#v-cal .item[data-day="2026-10-12"]').click(); await wait(10);
  check('Unterseite kommt von rechts', visible('day') && $('#v-day').classList.contains('fwd'));
  w.dispatchEvent(new w.PopStateEvent('popstate', {state: null})); await wait(10);
  check('Zurück kommt von links', visible('cal') && $('#v-cal').classList.contains('back'));
  $('#tabs #nav-add').click(); await wait(10);
  check('Formular kommt von unten', visible('form') && $('#v-form').classList.contains('up'));
  $('#f-stepnext').click();
  check('Nächster Schritt gleitet von rechts', $('#v-form .step[data-step="2"]').classList.contains('s-fwd'));
  check('App-Verhalten: kein Markieren, kein Neuladen durch Ziehen', /button,[^{]*\{-webkit-user-select:none;user-select:none/.test(html) && html.includes('overscroll-behavior-y:contain'));
  check('Animationen nur ohne „Bewegung reduzieren“', html.includes('@media (prefers-reduced-motion:no-preference){\r\n  .btn:not(:disabled):active') || html.includes('@media (prefers-reduced-motion:no-preference){\n  .btn:not(:disabled):active'));
  // Bewegung reduzieren
  seed([E('m1', '2026-10-12', NIGHT)]);
  await start({reduce: true});
  $('#tabs [data-view="cal"]').click(); await wait(10);
  check('Bewegung reduziert: nichts gleitet', !$('#v-cal').classList.contains('v-in'));
  $('#tabs [data-view="list"]').click(); await wait(10);
  $('.today [data-quick]').click(); await wait(10);
  check('Bewegung reduziert: Betrag sofort fertig', !$('#v-list [data-from]') && T($('#v-list [data-count]').textContent) === eur(+$('#v-list [data-count]').dataset.count));

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
