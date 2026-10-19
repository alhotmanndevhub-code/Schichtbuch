// Content-Security-Policy in index.html: Prüfsummen (sha256) der Skripte berechnen, prüfen und neu eintragen.
// Nach jeder Änderung an einem Skript in index.html: „npm run csp“, sonst blockiert der Browser das Skript (ein Test prüft das).
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const FILE = path.join(__dirname, '..', 'index.html');
const META = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/;
// Der Browser rechnet mit dem Skripttext nach dem Einlesen, dabei werden alle Zeilenenden zu \n
const norm = s => s.replace(/\r\n?/g, '\n');
// Text aller <script>-Blöcke ohne src, in der Reihenfolge im Dokument
function inlineScripts(html) {
  const out = [], re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) if (!/\ssrc\s*=/i.test(m[1] || '')) out.push(norm(m[2]));
  return out;
}
const hashes = html => inlineScripts(html).map(s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'");
// Regeln als Objekt, z. B. {'default-src': ["'self'"], 'script-src': ["'self'", "'sha256-…'"]}
function policy(html) {
  const m = html.match(META); if (!m) return null;
  const p = {};
  m[1].split(';').map(s => s.trim()).filter(Boolean).forEach(r => { const [k, ...v] = r.split(/\s+/); p[k] = v; });
  return p;
}
// Prüfsummen in script-src neu eintragen; alles andere an der Regel bleibt, wie es ist
function fix() {
  const html = fs.readFileSync(FILE, 'utf8'), m = html.match(META);
  if (!m) throw new Error('In index.html steht keine Content-Security-Policy.');
  const content = m[1].replace(/script-src [^;]*/, "script-src 'self' " + hashes(html).join(' '));
  if (content === m[1]) return false;
  fs.writeFileSync(FILE, html.replace(m[0], m[0].replace(m[1], content)));
  return true;
}
module.exports = {inlineScripts, hashes, policy, META};
if (require.main === module) console.log(fix() ? 'Prüfsummen in index.html neu eingetragen.' : 'Prüfsummen sind aktuell.');
