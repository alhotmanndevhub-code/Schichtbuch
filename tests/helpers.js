// Gemeinsame Hilfen für die Prüftests: App laden, feste Uhrzeit, Pfade
const path = require('path');
const ROOT = path.join(__dirname, '..');
// Alle Tests laufen mit einer festen Uhrzeit, damit sie in jedem Jahr gleich ausfallen
const NOW = Date.parse('2026-10-13T10:00:00Z');
const nowIso = (offsetDays = 0) => new Date(NOW + offsetDays * 864e5).toISOString();
function installClock(w) {
  const Real = w.Date;
  class FixedDate extends Real {
    constructor(...a) { if (a.length) super(...a); else super(NOW); }
    static now() { return NOW; }
  }
  w.Date = FixedDate;
}
module.exports = {ROOT, NOW, nowIso, installClock};
