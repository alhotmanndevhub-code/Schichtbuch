// Führt alle Prüftests aus. Beendet sich mit Fehlercode, sobald ein Test fehlschlägt.
const {spawnSync} = require('child_process');
const fs = require('fs'); const path = require('path');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], {encoding: 'utf8', timeout: 180000});
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`\n=== ${f}: ${ok ? 'bestanden' : 'FEHLGESCHLAGEN'}`);
  console.log(ok ? out.split('\n').filter(l => l.startsWith('OK')).length + ' Prüfungen in Ordnung' : out);
}
console.log(`\n${files.length - failed} von ${files.length} Testdateien bestanden.`);
process.exit(failed ? 1 : 0);
