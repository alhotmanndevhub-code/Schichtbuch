// Test Version 2.3.0: erster Start mit drei Fragen (Fahrzeug mit Bundesland, fester Ort laut Vertrag, Auslöse),
// sofort gespeichert, Zurück und Überspringen, danach die leere Startseite mit dem ersten Arbeitstag
const {JSDOM} = require('jsdom'); const fs = require('fs');
const H = require('./helpers');
const html = fs.readFileSync(H.ROOT + '/index.html', 'utf8');
const KEY = 'sakra-schichtbuch-v1';
let store = {}, buzzes = [];
function boot() {
  return new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/schichtbuch/',
    beforeParse(w) { H.installClock(w);
      Object.defineProperty(w, 'localStorage', {value: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k]}});
      Object.defineProperty(w.navigator, 'vibrate', {value: p => { buzzes.push(p); return true; }, configurable: true});
      w.scrollTo = () => {};
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = s => (s || '').replace(/\s+/g, ' ').trim();
const data = () => JSON.parse(store[KEY] || '{}');
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const E = (id, date, o) => Object.assign({id, date, year: +date.slice(0, 4), type: 'arbeit', shift: 'frueh', start: '05:00', end: '13:30', pause: 30, travelMin: 0, place: '', line: '', project: '', away: 'none',
  depart: '', ret: '', meals: {}, lodging: 0, lodgingName: '', vehicle: '', trip: 'dienst', meet: '', km: 0, allowance: 0, otherCost: 0, otherNote: '', note: '', photos: [], updated: '2026-01-01T00:00:00Z'}, o);

(async () => {
  let dom, w, d, $;
  const start = async () => { if (dom) dom.window.close(); buzzes = []; dom = boot(); w = dom.window; d = w.document; $ = s => d.querySelector(s); await wait(60); };
  const visible = id => !$('#v-' + id).hidden;
  const inp = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', {bubbles: true})); };
  const pressed = () => [...d.querySelectorAll('#v-setup .su-opt[aria-pressed="true"]')].map(b => b.dataset.su).join(',');
  const q = () => T($('#v-setup .su-n').textContent) + ' | ' + T($('#v-setup h2').textContent);
  const go = a => $(`#v-setup [data-su-go="${a}"]`).click();
  const pick = v => $(`#v-setup [data-su="${v}"]`).click();
  const st = () => data().settings || {};

  // ---------- A: neuer Nutzer, alle drei Fragen ----------
  store = {}; await start();
  check('Neuer Nutzer: Willkommen', visible('welcome'));
  $('[data-welcome="start"]').click(); await wait(10);
  check('Los geht’s: Frage 1 als eigene Seite ohne untere Leiste', visible('setup') && d.body.dataset.screen === 'setup' && $('#tabs').hidden && q() === 'Frage 1 von 3 | Wie kommst du meistens zur Arbeit?', q());
  check('Vier Antworten, noch keine gewählt, Fortschritt 1 von 3', d.querySelectorAll('#v-setup .su-opt').length === 4 && pressed() === '' && d.querySelectorAll('#v-setup .su-prog i.on').length === 1);
  check('Zurück-Taste des Handys passt (Verlaufseintrag)', JSON.stringify(w.history.state) === '{"s":1}');
  pick('mit');
  check('Mitfahrer gewählt und sofort gespeichert, noch nicht fertig eingerichtet', pressed() === 'mit' && st().veh === 'mit' && !st().profSeen, JSON.stringify({v: st().veh, p: st().profSeen}));
  pick('mit');
  check('Nochmal getippt: wieder abgewählt', pressed() === '' && st().veh === '');
  pick('mit');
  const sel = $('#su-state'); sel.value = 'BY'; sel.dispatchEvent(new w.Event('change', {bubbles: true}));
  check('Bundesland für die Feiertage', st().state === 'BY');
  go('next');
  check('Weiter: Frage 2 zum festen Ort', q() === 'Frage 2 von 3 | Steht im Arbeitsvertrag ein fester Ort, zu dem du jeden Tag fährst?' && pressed() === 'none' && !$('#su-fname') && d.querySelectorAll('#v-setup .su-prog i.on').length === 2, q());
  pick('sammel');
  check('Sammelpunkt: Name und Entfernung abfragen', !!$('#su-fname') && !!$('#su-fkm') && st().fixed === 'sammel');
  inp($('#su-fname'), 'Bf Soest'); inp($('#su-fkm'), '24');
  check('Name und Entfernung gespeichert', st().fixedName === 'Bf Soest' && st().fixedKm === 24, JSON.stringify({n: st().fixedName, k: st().fixedKm}));
  go('back');
  check('Zurück: Frage 1 mit der Antwort von eben', q().startsWith('Frage 1 von 3') && pressed() === 'mit' && $('#su-state').value === 'BY');
  go('next');
  check('Wieder vor: Antworten stehen noch da', pressed() === 'sammel' && $('#su-fname').value === 'Bf Soest' && $('#su-fkm').value === '24');
  go('next');
  check('Frage 3 zur Auslöse, Knopf „Fertig“, Hinweis auf die Einstellungen', q() === 'Frage 3 von 3 | Zahlt deine Firma Auslöse oder Spesen?' && pressed() === '0' && T($('[data-su-go="done"]').textContent) === 'Fertig' && T($('#v-setup .su-rest').textContent).includes('Mehr > Einstellungen'), q());
  pick('1');
  check('Auslöse ja: drei Beträge abfragen', !!$('#su-afull') && !!$('#su-ahalf') && !!$('#su-aday') && st().ausOn === true);
  inp($('#su-afull'), '42'); inp($('#su-ahalf'), '21');
  check('Beträge gespeichert', st().ausFull === 42 && st().ausHalf === 21 && st().ausDay === 0);
  go('done'); await wait(20);
  check('Fertig: Startseite, gilt als eingerichtet', visible('list') && st().profSeen === true && !$('#tabs').hidden && w.history.state === null);
  check('Meldung und kurzes Vibrieren', T($('#toast').textContent) === 'Fertig eingerichtet' && buzzes.length === 1);
  const home = T($('#v-list').textContent);
  check('Leere Startseite: „Heute“ mit dem ersten Arbeitstag, darunter ein Beispiel', home.includes('Heute noch offen') && T($('.today [data-new="2026-10-13"]').textContent) === 'Ersten Arbeitstag erfassen' && T($('#v-list .empty h2').textContent) === 'Noch keine Einträge' && !!$('#v-list .row.example'), home.slice(0, 160));
  check('Glocke: kein Hinweis zum Einrichten mehr', !T($('#bell-list').textContent).includes('Stell einmal ein'));
  // Einstellungen zeigen die Antworten
  $('#nav-settings').click(); await wait(10);
  check('Einstellungen zeigen die Antworten', $('[data-pset="veh"] [aria-pressed="true"]').dataset.v === 'mit' && $('[data-pset="fixed"] [aria-pressed="true"]').dataset.v === 'sammel' && $('#p-fixed-name').value === 'Bf Soest' && $('#s-aus-full').value === '42,00' && $('#s-state').value === 'BY');
  // erster Tag ist passend vorbelegt
  $('#tabs [data-view="list"]').click(); await wait(10);
  $('.today [data-new]').click(); await wait(10);
  $('#f-quick').click(); await wait(20);
  const e1 = Object.values(data().entries)[0];
  check('Erster Tag: als Mitfahrer zum Sammelpunkt vorbelegt', e1 && e1.vehicle === 'mit' && e1.trip === 'sammel' && e1.km === 24 && e1.meet === 'Bf Soest', JSON.stringify(e1 && {v: e1.vehicle, t: e1.trip, k: e1.km, m: e1.meet}));

  // ---------- B: Überspringen ----------
  store = {}; await start();
  $('[data-welcome="start"]').click(); await wait(10);
  go('skip'); await wait(20);
  check('Überspringen: Startseite, nicht noch einmal fragen', visible('list') && st().profSeen === true && st().veh === '' && T($('#toast').textContent) !== 'Fertig eingerichtet' && w.history.state === null);
  await start();
  check('Nach Neustart kein Willkommen mehr', visible('list') && !visible('welcome'));

  // ---------- C: später über die Glocke, Zurück-Taste ----------
  store = {[KEY]: JSON.stringify({version: 4, entries: {a1: E('a1', '2026-10-12')}, expenses: {}, lastBackup: H.nowIso(), seenVersion: '2.3.0', settings: {profSeen: false, ausFull: 0}})};
  await start();
  $('[data-bell]').click(); await wait(10);
  $('#bell-list [data-setup="start"]').click(); await wait(20);
  check('Glocke „Jetzt einrichten“: die drei Fragen', visible('setup') && $('#bell').hidden && q().startsWith('Frage 1 von 3'));
  w.dispatchEvent(new w.PopStateEvent('popstate', {state: null})); await wait(10);
  check('Zurück-Taste: wieder Startseite, Hinweis bleibt', visible('list') && !st().profSeen && T($('#bell-list').textContent).includes('Jetzt einrichten'));
  $('[data-bell]').click(); await wait(10); $('#bell-list [data-setup="start"]').click(); await wait(20);
  go('back'); await wait(20);
  check('Zurück bei Frage 1: wieder Startseite', visible('list'));

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
