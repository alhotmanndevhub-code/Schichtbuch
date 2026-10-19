// Test Version 2.2.0 (Paket C „Aufräumen“): Erklärungen hinter dem Info-Zeichen, seltene Auswahl hinter „Mehr“,
// Signalfarben mit fester Bedeutung, Warnungen als ruhige Zeile mit Lampe, keine gesperrten Großbuchstaben
const {JSDOM} = require('jsdom'); const fs = require('fs');
const H = require('./helpers');
const html = fs.readFileSync(H.ROOT + '/index.html', 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
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
  depart: '', ret: '', meals: {}, lodging: 0, lodgingName: '', vehicle: '', trip: 'dienst', meet: '', km: 0, allowance: 0, otherCost: 0, otherNote: '', note: '', photos: [], updated: '2026-01-01T00:00:00Z'}, o);
const seed = (entries, settings) => {
  store = {}; const m = {}; entries.forEach(e => m[e.id] = e);
  store[KEY] = JSON.stringify({version: 4, entries: m, expenses: {}, lastBackup: H.nowIso(), seenVersion: '2.2.0',
    settings: Object.assign({ausFull: 0, ausHalf: 0, profSeen: true, state: 'NW'}, settings || {})});
};
// CSS-Regel als Text, z. B. rule('.warn{')
const rule = start => { const i = css.indexOf(start); return i < 0 ? '' : css.slice(i, css.indexOf('}', i) + 1); };

(async () => {
  let dom, w, d, $;
  const start = async () => { if (dom) dom.window.close(); dom = boot(); w = dom.window; d = w.document; $ = s => d.querySelector(s); await wait(60); };
  const openNew = date => { const b = d.createElement('button'); b.dataset.new = date; $('#v-list').appendChild(b); b.click(); b.remove(); };
  const openId = id => { const b = d.createElement('button'); b.dataset.id = id; $('#v-list').appendChild(b); b.click(); b.remove(); };
  const ibOf = id => $(`.ib[aria-controls~="${id}"]`);
  const shown = g => [...d.querySelectorAll(g + ' button[data-v]:not(.rare)')].map(b => b.dataset.v).join(',');
  const folded = g => [...d.querySelectorAll(g + ' button[data-v].rare')].map(b => b.dataset.v).join(',');
  const more = g => $(g + ' .seg-more');

  // ---------- A: Erklärungen hinter dem Info-Zeichen ----------
  seed([E('v0', '2026-10-09', {shift: 'tag', start: '07:00', end: '15:30', away: 'tag', depart: '06:00', ret: '17:00'}), E('v1', '2026-10-12', {shift: 'tag', start: '07:00', end: '15:30', place: 'Hamm'})], {veh: 'pkw'});
  await start();
  const TIPS = ['h-travel', 'h-away', 'h-shift', 'h-drive', 'h-trip', 'h-allow', 'h-beleg', 'h-cat', 'h-pbeleg', 'h-theme', 'h-prof', 'h-veh', 'p-fixed-h', 'h-aus', 'h-xlsx', 'r-info', 'h-backup', 'h-settings'];
  check('Erklärtexte sind auf Abruf (Klasse tip) und haben ein Info-Zeichen', TIPS.every(id => $('#' + id) && $('#' + id).classList.contains('tip') && ibOf(id)), TIPS.filter(id => !($('#' + id) && $('#' + id).classList.contains('tip') && ibOf(id))).join(','));
  check('Jeder Erklärtext hat sein Info-Zeichen', [...d.querySelectorAll('.tip')].every(t => ibOf(t.id)));
  check('Info-Zeichen sind beschriftete Knöpfe mit Material-Symbol', [...d.querySelectorAll('.ib')].every(b => b.type === 'button' && /^Erklärung zu .+/.test(b.getAttribute('aria-label')) && b.querySelector('use[href="#i-info"]')));
  check('Info-Zeichen hängt am letzten Wort (kein Zeichen allein in einer Zeile)', T($('#b-away .blk-h .nobr').textContent) === 'Montage' && !!$('#b-away .blk-h .nobr .ib'));
  openNew('2026-10-13');
  const ia = ibOf('h-away');
  check('Neues Formular: Erklärung zu, Zeichen da', !$('#h-away').classList.contains('on') && ia.getAttribute('aria-expanded') === 'false' && !ia.hidden && T($('#h-away').textContent) !== '');
  ia.click();
  check('Tipp auf das Zeichen: Erklärung offen', $('#h-away').classList.contains('on') && ia.getAttribute('aria-expanded') === 'true');
  $('#g-away [data-v="tag"]').click();
  check('Bleibt offen, Text folgt der Auswahl', $('#h-away').classList.contains('on') && T($('#h-away').textContent).startsWith('Morgens los'), T($('#h-away').textContent).slice(0, 30));
  ia.click();
  check('Zweiter Tipp: wieder zu', !$('#h-away').classList.contains('on') && ia.getAttribute('aria-expanded') === 'false');
  ia.click(); $('#f-back').click(); await wait(10);
  openNew('2026-10-14');
  check('Nächstes Formular: Erklärungen wieder zu', !$('#h-away').classList.contains('on') && ibOf('h-away').getAttribute('aria-expanded') === 'false');
  check('Nichts zu erklären, kein Zeichen (Schicht ohne Ausfall)', ibOf('h-shift').hidden);
  $('#g-shift .seg-more').click(); $('#g-shift [data-v="ausfall"]').click();
  check('Ausfallschicht: Zeichen bei „Schicht“ erscheint', !ibOf('h-shift').hidden && !$('#h-shift').hidden);
  check('Erklärung bleibt da, auch wenn der Schritt gerade nicht zu sehen ist', !ibOf('h-beleg').hidden || $('#b-beleg').hidden);
  $('#g-vehicle .seg-more').click(); $('#g-vehicle [data-v="firma"]').click();
  check('Firmenwagen: Erklärung hinter dem Zeichen bei „Fahrt“, Rechnung leer', !ibOf('h-drive').hidden && T($('#h-drive').textContent).includes('keine Fahrtkosten') && T($('#c-drive').textContent) === '');
  $('#g-vehicle [data-v="pkw"]').click(); $('#g-away [data-v="none"]').click();
  const km = $('#f-km'); km.value = '40'; km.dispatchEvent(new w.Event('input', {bubbles: true}));
  check('Eigenes Auto ohne Auswärts: Warnung bleibt sichtbar (gelbe Lampe)', !!$('#c-drive .warn') && T($('#c-drive').textContent).startsWith('Zählt als Dienstfahrt nur'), T($('#c-drive').textContent));
  $('#f-back').click(); await wait(10);
  if (!$('#f-leave').hidden) { $('[data-leave="drop"]').click(); await wait(10); }

  // Warnungen bleiben sichtbar, ohne Info-Zeichen
  openNew('2026-10-20'); $('#g-away .seg-more').click(); $('#g-away [data-v="voll"]').click();
  check('Warnung zum Vortag steht sofort da, nicht hinter dem Zeichen', !$('#h-prev').hidden && $('#h-prev').classList.contains('warn') && !$('#h-prev').classList.contains('tip'));
  check('Vorbelegt: ruhige Zeile mit Lampe statt farbigem Kasten', $('#f-prefill').classList.contains('warn') && !$('#f-prefill').classList.contains('note'));
  $('#f-back').click(); await wait(10);
  if (!$('#f-leave').hidden) { $('[data-leave="drop"]').click(); await wait(10); }

  // Einstellungen: Zeichen nur, wenn der Text gerade zu sehen wäre
  $('#nav-settings').click(); await wait(10);
  check('Auslöse „Nein“: kein Zeichen (Felder zu)', $('#p-aus-w').hidden && ibOf('h-aus').hidden);
  $('[data-pset="ausOn"] [data-v="1"]').click();
  check('Auslöse „Ja“: Zeichen da', !$('#p-aus-w').hidden && !ibOf('h-aus').hidden);
  ibOf('h-prof').click();
  check('„Deine Arbeit“: Erklärung auf Tipp', $('#h-prof').classList.contains('on'));

  // Auswertung: Erklärungen auf Abruf, Zahlen und Warnungen sichtbar
  $('#tabs [data-view="stats"]').click(); await wait(10);
  check('Auswertung: Hinweis zur Schätzung hinter dem Zeichen', $('#t-sum').classList.contains('tip') && !!ibOf('t-sum') && !$('#stats-body .info'));
  check('Auswertung: Titel statt Überzeile', T($('.bigsum h3').textContent) === 'Voraussichtliche Werbungskosten 2026' && !$('.bigsum .eyebrow'));
  check('Nr. 20: Erklärung auf Abruf, Schätzung sichtbar', $('#t-nr20').classList.contains('tip') && T($('#st-lstb').textContent).includes('Solange das Feld leer ist, schätzt die App den Betrag aus deinen Einträgen'), T($('#st-lstb').textContent));
  ibOf('t-nr20').click();
  const nr = $('#st-nr20'); nr.value = '10'; nr.dispatchEvent(new w.Event('change', {bubbles: true})); await wait(10);
  check('Nach neuem Zeichnen bleibt die geöffnete Erklärung offen', $('#t-nr20').classList.contains('on') && ibOf('t-nr20').getAttribute('aria-expanded') === 'true');
  check('Abweichung von Nr. 20 bleibt als Warnung sichtbar', !!$('#st-lstb .warn:not(.tip)'));

  // ---------- B: Seltene Auswahl hinter „Mehr“ ----------
  seed([E('m1', '2026-10-11', {type: 'anreise', away: 'an', depart: '14:00'}), E('u1', '2026-10-05', {type: 'urlaub'})], {veh: 'pkw'});
  await start();
  openNew('2026-10-08');
  check('Art: Arbeit, Anreise, Abreise vorne, Rest hinter „Mehr“', shown('#g-type') === 'arbeit,anreise,abreise' && folded('#g-type') === 'schulung,frei,urlaub,krank' && !more('#g-type').hidden, shown('#g-type') + ' | ' + folded('#g-type'));
  check('„Mehr“ ist kein Auswahlknopf', !more('#g-type').hasAttribute('aria-pressed') && !more('#g-type').dataset.v && more('#g-type').getAttribute('aria-expanded') === 'false');
  check('Schicht: nur Ausfall hinter „Mehr“', shown('#g-shift') === 'frueh,tag,spaet,nacht' && folded('#g-shift') === 'ausfall');
  check('Auswärts ohne Nacht davor: 24 Std. und Abreise hinter „Mehr“', shown('#g-away') === 'none,tag,an' && folded('#g-away') === 'voll,ab', shown('#g-away'));
  check('Fahrzeug: eigenes Auto und Firmenwagen vorne', shown('#g-vehicle') === 'pkw,firma' && folded('#g-vehicle') === ',mit,oepnv', shown('#g-vehicle') + ' | ' + folded('#g-vehicle'));
  more('#g-type').click();
  check('Tipp auf „Mehr“: alles offen, „Mehr“ weg, Fokus auf der ersten neuen Auswahl', $('#g-type').classList.contains('open') && more('#g-type').hidden && d.activeElement && d.activeElement.dataset.v === 'schulung');
  $('#g-type [data-v="urlaub"]').click();
  $('#f-save').click(); await wait(20);
  check('Urlaub gespeichert', Object.values(data().entries).some(e => e.date === '2026-10-08' && e.type === 'urlaub'));
  openId('u1');
  check('Gewählte seltene Auswahl bleibt vorne, „Mehr“ wieder zu', shown('#g-type') === 'arbeit,anreise,abreise,urlaub' && !$('#g-type').classList.contains('open') && !more('#g-type').hidden, shown('#g-type'));
  $('#f-back').click(); await wait(10);
  openNew('2026-10-12');
  check('Nach Anreise am Vortag: 24 Std. und Abreise vorne, Tagestour und Anreise hinter „Mehr“', shown('#g-away') === 'none,voll,ab' && folded('#g-away') === 'tag,an', shown('#g-away') + ' | ' + folded('#g-away'));
  const dt = $('#f-date'); dt.value = '2026-10-15'; dt.dispatchEvent(new w.Event('input', {bubbles: true}));
  check('Anderes Datum ohne Nacht davor: Tagestour und Anreise wieder vorne, gewählte 24 Std. bleibt', shown('#g-away') === 'none,tag,an,voll' && folded('#g-away') === 'ab', shown('#g-away') + ' | ' + folded('#g-away'));
  $('#f-back').click(); await wait(10);
  if (!$('#f-leave').hidden) { $('[data-leave="drop"]').click(); await wait(10); }
  seed([], {veh: 'mit'});
  await start();
  openNew('2026-10-08');
  check('Fahrzeug laut „Deine Arbeit“ (Mitfahrer) steht vorne', shown('#g-vehicle') === 'pkw,firma,mit' && folded('#g-vehicle') === ',oepnv', shown('#g-vehicle') + ' | ' + folded('#g-vehicle'));

  // ---------- C: Signalfarben ----------
  check('Gewählte Knöpfe hell statt rot', /background:var\(--ink\)/.test(rule('.seg button[aria-pressed="true"]{')) && !/accent/.test(rule('.seg button[aria-pressed="true"]{')));
  check('Navigation und Schritte nicht rot', /--nav-active:#F6F6F4/.test(css) && !/accent/.test(rule('.stepper button[aria-current="step"] .num{')) && !/accent/.test(rule('  .sidebar button[aria-current="page"]{')));
  check('Kalender: heute nicht rot, Arbeitstag grün (erfasst), Ausgabe nicht rot', !/accent/.test(rule('.cday.today .n{')) && /--d-work:#4CC38A/.test(css) && !/--d-exp:#(EF5350|D32F2F)/i.test(css));
  check('Kategorien ohne Rot und Gelb (Ring, Kalender)', !/--c-(lodge|meal):#(D94848|D32F2F|C98500|F59E0B)/i.test(css) && !/--d-(work|lodge):#(F59E0B|E39200|F48FB1|D6457C)/i.test(css));
  check('Gelb nur für „bitte prüfen“: Auswärts-Chip und Balken nicht gelb', !/amber/.test(rule('.chip.away{')) && !/amber/.test(rule('.pill{')) && !/amber/.test(rule('.bar i{')));
  check('Signallampen: grün, gelb, rot', /--good/.test(rule('.lamp.ok{')) && /--amber/.test(rule('.lamp.open{')) && /--danger/.test(rule('.lamp.miss{')));
  check('Tagesdetail: dunkle Karten statt heller (--hl gibt es nicht mehr)', !/--hl/.test(html) && /background:var\(--surface\)/.test(rule('.subc{')));
  check('PC: nur eine rote Hauptaktion auf der Startseite (Einsatz-Knopf nicht rot)', !/btn primary d-only/.test(html));

  // ---------- D: Randstreifen weg, Hinweise als Zeile mit Lampe ----------
  check('Keine farbigen Randstreifen', !/border-(left|right):\s*[2-9]px/.test(css), (css.match(/border-(left|right):\s*[2-9]px[^;}]*/g) || []).join(' '));
  check('Warnung: Zeile mit gelber Lampe, ohne Kasten', /var\(--amber\)/.test(rule('.warn::before{')) && !/background/.test(rule('.warn{')));
  seed([E('n1', '2026-10-12', {shift: 'tag', start: '07:00', end: '15:30'})], {profSeen: false});
  store[KEY] = JSON.stringify(Object.assign(data(), {seenVersion: '2.1.0'}));
  await start();
  $('[data-bell]').click();
  check('Glocke: Neuigkeiten mit grüner Lampe', !!$('#bell-list .news .lamp.ok') && T($('#bell-list .news b').textContent) === 'Neu in Version 2.2.0' && T($('#bell-list .news').textContent).includes('kleinen i'));
  check('Glocke: Einrichten mit gelber Lampe', !!$('#bell-list .snote:not(.news) .lamp.open') && T($('#bell-list').textContent).includes('Jetzt einrichten'));
  $('#bell-list [data-news]').click(); await wait(10);
  check('Verstanden: Glocke bleibt für den Rest offen', !$('#bell').hidden && !$('#bell-list .news') && !!$('#bell-list .snote'));

  // ---------- E: keine gesperrten Großbuchstaben ----------
  check('Keine Großbuchstaben per CSS', !/text-transform:\s*uppercase/.test(css));
  check('Keine weite Sperrung (nur Schriftzug und große Zahlen leicht)', !(css.match(/letter-spacing:\s*\.(0[4-9]|[1-9])/g) || []).length, (css.match(/letter-spacing:[^;}]*/g) || []).join(' '));
  check('Blocktitel durch Größe und Gewicht', /font:700 17px/.test(rule('.blk-h{')) && /var\(--ink\)/.test(rule('.blk-h{')));

  console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
