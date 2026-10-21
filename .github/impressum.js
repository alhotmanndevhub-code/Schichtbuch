// Setzt beim Veröffentlichen Name und Adresse in Impressum und Datenschutzerklärung ein (Aufruf in workflows/pruefen.yml).
// Die Werte kommen aus geheimen Werten des Repositorys (Settings > Secrets and variables > Actions), damit sie nur auf der
// Webseite stehen und nie im öffentlichen Repository. Ohne alle drei Werte bricht die Veröffentlichung ab, statt Platzhalter zu zeigen.
// Aufruf: node .github/impressum.js _site
const fs = require('fs'), path = require('path');
const FELDER = {name: 'IMPRESSUM_NAME', strasse: 'IMPRESSUM_STRASSE', ort: 'IMPRESSUM_ORT'};
const SEITEN = ['impressum.html', 'datenschutz.html'];
const esc = s => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

function einsetzen(dir, env = process.env) {
  const fehlt = Object.values(FELDER).filter(k => !String(env[k] || '').trim());
  if (fehlt.length) throw new Error('Geheime Werte fehlen: ' + fehlt.join(', ') + ' (Settings > Secrets and variables > Actions)');
  for (const seite of SEITEN) {
    const f = path.join(dir, seite);
    const html = fs.readFileSync(f, 'utf8').replace(/<span data-fill="([a-z]+)">[^<]*<\/span>/g, (m, feld) => {
      if (!FELDER[feld]) throw new Error(`Unbekanntes Feld „${feld}“ in ${seite}`);
      return esc(String(env[FELDER[feld]]).trim());
    });
    if (/<span data-fill=/.test(html)) throw new Error('Nicht ersetzte Felder in ' + seite);
    fs.writeFileSync(f, html);
  }
}
module.exports = {einsetzen, FELDER, SEITEN};

if (require.main === module) {
  try { einsetzen(process.argv[2] || '_site'); console.log('Name und Adresse eingesetzt in ' + SEITEN.join(' und ')); }
  catch (e) { console.error('::error::' + e.message); process.exit(1); }
}
