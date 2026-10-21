// Test Impressum und Datenschutzerklärung: Im Repository stehen nur Platzhalter, Name und Adresse setzt .github/impressum.js
// beim Veröffentlichen aus geheimen Werten ein (mit HTML-Schutz). Ohne Werte bricht es ab. Seiten ohne Skripte, Workflow kopiert sie.
const fs = require('fs'); const os = require('os'); const path = require('path');
const H = require('./helpers');
const {einsetzen, FELDER, SEITEN} = require('../.github/impressum.js');
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const read = f => fs.readFileSync(path.join(H.ROOT, f), 'utf8');
const ENV = {IMPRESSUM_NAME: 'Thomas Müller & Söhne', IMPRESSUM_STRASSE: 'Gleisweg 12', IMPRESSUM_ORT: '59423 Unna <test>'};

for (const seite of SEITEN) {
  const html = read(seite);
  const felder = [...html.matchAll(/<span data-fill="([a-z]+)">([^<]*)<\/span>/g)];
  check(seite + ': alle drei Felder vorhanden', ['name', 'strasse', 'ort'].every(f => felder.some(m => m[1] === f)), felder.map(m => m[1]).join(','));
  // Schutz gegen echte Daten im Repository: in den Feldern dürfen nur Platzhalter in eckigen Klammern stehen
  check(seite + ': nur Platzhalter, keine echten Daten', felder.every(m => /^\[[^\]]+\]$/.test(m[2])), felder.map(m => m[2]).join(' | '));
  check(seite + ': keine Skripte (CSP script-src none, kein <script>)', /script-src 'none'/.test(html) && !/<script/i.test(html) && !/\son\w+=/i.test(html));
  check(seite + ': Kontakt-E-Mail ist die Adresse der App', html.includes('kontakt@montagebuch.de') && !/@gmail\.com/i.test(html));
  check(seite + ': Link zurück zur App', html.includes('href="./"'));
}
check('Seiten verlinken einander', read('impressum.html').includes('href="datenschutz.html"') && read('datenschutz.html').includes('href="impressum.html"'));
const app = read('index.html'), m0 = app.indexOf('<section id="v-more"'), more = app.slice(m0, app.indexOf('</section>', m0));
check('App verlinkt beide Seiten unter „Mehr“', m0 > 0 && more.includes('href="impressum.html"') && more.includes('href="datenschutz.html"'));
const ver = (app.match(/APP_VERSION = '([^']+)'/) || [])[1];
check('Version 2.5.1 in App und Offline-Speicher', ver === '2.5.1' && read('sw.js').includes("const VERSION = '2.5.1';"), ver);
check('„Was ist neu“ nennt Impressum und Datenschutzerklärung', /\['2\.5\.1', \['Impressum und Datenschutzerklärung/.test(app));
// Der Service Worker beantwortet nur die App selbst, die beiden Seiten kommen direkt vom Netz
const sw = read('sw.js'), guard = /if \(isPage && !\/\\\/\(index\\\.html\)\?\$\/\.test\(url\.pathname\)\) return;/;
check('Service Worker lässt Impressum und Datenschutzerklärung durch', guard.test(sw) && !/\/(index\.html)?$/.test('/datenschutz.html') && !/\/(index\.html)?$/.test('/impressum.html'));

// Einsetzen in einer Kopie, wie beim Veröffentlichen in _site
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'impressum-'));
for (const s of SEITEN) fs.copyFileSync(path.join(H.ROOT, s), path.join(dir, s));
let err = null;
try { einsetzen(dir, {IMPRESSUM_NAME: 'X', IMPRESSUM_STRASSE: ''}); } catch (e) { err = e; }
check('Ohne alle Werte bricht es ab und nennt die fehlenden', err && /IMPRESSUM_STRASSE/.test(err.message) && /IMPRESSUM_ORT/.test(err.message), err && err.message);
check('Abbruch ändert nichts an den Seiten', SEITEN.every(s => fs.readFileSync(path.join(dir, s), 'utf8') === read(s)));
einsetzen(dir, ENV);
for (const s of SEITEN) {
  const out = fs.readFileSync(path.join(dir, s), 'utf8');
  check(s + ': Name und Adresse eingesetzt, mit HTML-Schutz', out.includes('Thomas Müller &amp; Söhne') && out.includes('Gleisweg 12') && out.includes('59423 Unna &lt;test&gt;'));
  check(s + ': keine Platzhalter mehr', !/<span data-fill=/.test(out) && !out.includes('[Vor- und Nachname]'));
}
fs.rmSync(dir, {recursive: true, force: true});

// Workflow: Seiten werden mitveröffentlicht, die Werte kommen aus den geheimen Werten
const wf = read('.github/workflows/pruefen.yml');
const cp = (wf.match(/cp index\.html[^\n]*_site\//) || [''])[0];
check('Workflow kopiert Impressum und Datenschutzerklärung', cp.includes('impressum.html') && cp.includes('datenschutz.html'), cp);
check('Workflow setzt die Werte aus den geheimen Werten ein', /run: node \.github\/impressum\.js _site/.test(wf) && Object.values(FELDER).every(k => wf.includes(`${k}: \${{ secrets.${k} }}`)));
check('Einsetzen kommt nach dem Kopieren und vor dem Hochladen', wf.indexOf('cp index.html') < wf.indexOf('node .github/impressum.js') && wf.indexOf('node .github/impressum.js') < wf.indexOf('upload-pages-artifact'));
console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
process.exit(fails ? 1 : 0);
