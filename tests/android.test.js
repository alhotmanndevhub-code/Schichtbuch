// Test Android-App (Trusted Web Activity): Verknüpfung .well-known/assetlinks.json, Workflow veröffentlicht sie,
// Web-Manifest passt für die Hülle, und kein Signaturschlüssel landet im Repository.
const fs = require('fs'); const path = require('path');
const H = require('./helpers');
let fails = 0; const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK   ' : 'FEHL ') + name + (info !== '' && info != null ? ' | ' + info : '')); };
const read = f => fs.readFileSync(path.join(H.ROOT, f), 'utf8');

let links = null;
try { links = JSON.parse(read('.well-known/assetlinks.json')); } catch (e) { links = null; }
check('assetlinks.json ist gültiges JSON (Liste)', Array.isArray(links) && links.length >= 1);
const t = links && links[0] || {};
check('Verknüpfung für alle Adressen der Webseite', JSON.stringify(t.relation) === '["delegate_permission/common.handle_all_urls"]');
check('Paketname de.montagebuch.app', t.target && t.target.namespace === 'android_app' && t.target.package_name === 'de.montagebuch.app');
const fp = (t.target && t.target.sha256_cert_fingerprints) || [];
check('Fingerabdrücke im SHA-256-Format', fp.length >= 1 && fp.every(f => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)), fp.length + ' Stück');
check('Keine doppelten Fingerabdrücke', new Set(fp).size === fp.length);

const wf = read('.github/workflows/pruefen.yml');
check('Workflow veröffentlicht .well-known/assetlinks.json', /mkdir -p _site\/\.well-known/.test(wf) && /cp \.well-known\/assetlinks\.json _site\/\.well-known\//.test(wf));

const m = JSON.parse(read('manifest.webmanifest'));
check('Web-Manifest: Start und Bereich relativ, eigenständige Anzeige', m.start_url === './' && m.scope === './' && m.display === 'standalone');
check('Web-Manifest: Symbol 512 px und maskierbares Symbol für die Hülle', m.icons.some(i => i.sizes === '512x512' && i.purpose === 'any') && m.icons.some(i => i.purpose === 'maskable'));

const gi = read('.gitignore');
check('.gitignore schließt Signaturschlüssel aus', gi.includes('*.keystore') && gi.includes('*.jks'));
const keys = []; (function walk(d) { for (const f of fs.readdirSync(d, {withFileTypes: true})) { if (['node_modules', '.git'].includes(f.name)) continue; const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(keystore|jks)$/i.test(f.name)) keys.push(p); } })(H.ROOT);
check('Kein Signaturschlüssel im Projektordner', keys.length === 0, keys.join(', '));
console.log(fails ? fails + ' Fehler' : 'Alles bestanden');
process.exit(fails ? 1 : 0);
