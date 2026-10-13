# SAKRA Schichtbuch – Hinweise für Claude

## Was das ist

Web-App (PWA) für Sicherungsaufsichtskräfte und andere Beschäftigte im Gleisbau, die oft auf Montage sind. Man erfasst Arbeitstage, Schichten, An- und Abreise mit Fahrzeit, Montage, Fahrten, Auslöse und Ausgaben. Die App rechnet die Werbungskosten für die Anlage N aus und exportiert eine Excel-Datei.

- Live: https://alhotmanndevhub-code.github.io/Schichtbuch/
- Repository: `alhotmanndevhub-code/schichtbuch`, Branch `main`
- Nutzer: der Inhaber des Repositorys (kein Entwickler, schreibt Deutsch) und ein Freund als Tester. Später ist ein Abo geplant (etwa 1 € im Monat).

## Aufbau

- Die ganze App steht in `index.html` (HTML, CSS und JavaScript in einer Funktion). Kein Build-Schritt, kein Framework.
- `sw.js` ist der Service Worker: offline nutzbar, Hinweis „Neue Version verfügbar“ bei Updates.
- Keine fremden Server oder CDNs (Datenschutz). Schriften (`barlow-*.woff2`) und `exceljs.min.js` liegen im Repository.
- Daten liegen nur im `localStorage` des Geräts:
  - `sakra-schichtbuch-v1`: alle Einträge, Ausgaben, Einstellungen
  - `sakra-schichtbuch-v1-rev`: Speichernummer. `persist()` führt Änderungen aus zwei offenen Fenstern Eintrag für Eintrag zusammen, statt zu überschreiben.
  - `sakra-schichtbuch-v1-defekt`: Kopie unlesbarer Daten, bevor etwas überschrieben wird
- Sicherung und Wiederherstellung als JSON-Datei (Export > Sicherung).
- Gesetzliche Werte stehen in der Tabelle `LAW` (je Steuerjahr). Firmen- und Personenwerte stehen in `S.settings` („Deine Arbeit“).

## Regeln bei Änderungen

1. Vor jedem Commit `npm test` ausführen. Die Tests in `tests/` laufen mit jsdom und einer festen Uhrzeit (13.10.2026, siehe `tests/helpers.js`). Neue Funktionen bekommen eigene Tests.
2. Bei jeder Änderung, die live geht, `APP_VERSION` in `index.html` und `VERSION` in `sw.js` gleich hochzählen. Sonst bekommen installierte Apps das Update nicht.
3. Nutzerdaten dürfen nie verloren gehen. Den Speicherschlüssel nicht ändern. Alte Formate weiter lesen (`normEntry`, `mergeSettings`, `legacySettings`), z. B. den alten Typ `reise` oder Einstellungen ohne `ausFull`.
4. Handy zuerst: 360 px Breite ohne waagerechtes Scrollen, Hell- und Dunkelmodus prüfen (Screenshots mit Playwright).
5. Texte auf Deutsch, in Du-Form und einfacher Sprache. Die Nutzer sind keine Steuerexperten.
6. Nach dem Hochladen prüfen, ob die Live-Seite die neue Version ausliefert (`sw.js` abrufen).
7. Der Inhaber möchte vor größeren Änderungen gefragt werden und danach kurz hören, was sich geändert hat.

## Veröffentlichen

- Die GitHub Action `.github/workflows/pruefen.yml` lässt bei jedem Push die Tests laufen.
- Veröffentlicht wird nur nach bestandenen Tests, und nur wenn unter Settings > Pages die Quelle „GitHub Actions“ eingestellt ist. Sonst veröffentlicht GitHub Pages direkt aus `main`.
- Für die Webseite werden nur die App-Dateien veröffentlicht, nicht `tests/` oder diese Datei.

## Steuerregeln (im Code umgesetzt, Stand 2026)

- Gesetzliche Werte nur in `LAW`, in der App nicht änderbar. Jedes Jahr Anfang Januar prüfen und das neue Jahr ergänzen. Für Jahre ohne Eintrag zeigt die App einen Hinweis und rechnet mit dem letzten bekannten Jahr.
- Verpflegung: 14 € (mehr als 8 Std., An- und Abreisetag), 28 € (24 Std.). Gestellte Mahlzeiten kürzen um 20 % (Frühstück) bzw. 40 % (Mittag, Abend) von 28 €, höchstens bis 0.
- Mitternachtsregel: Eine Tagestour über Mitternacht zählt für den Kalendertag mit der längeren Abwesenheit (`vmaDate`), auch über den Jahreswechsel.
- Mehrere Tagestouren am selben Tag werden zusammengerechnet, Überschneidungen nur einmal.
- Dreimonatsfrist: nur ein Hinweis, keine Kürzung. Sie zählt nur Wochen mit mindestens 3 Tagen am selben Ort. Eine Unterbrechung von 4 Wochen startet sie neu. Gerechnet wird in Kalendermonaten.
- Dienstfahrt mit eigenem Auto: 0,30 € je gefahrenem km, nur an Tagen mit Auswärts-Angabe.
- Fester Sammelpunkt oder Betrieb laut Vertrag: Entfernungspauschale einmal pro Tag.
  - 2026: 0,38 € ab dem ersten km. Bis 2025: 0,30 € bis 20 km, ab dem 21. km 0,38 €.
  - Gilt auch als Mitfahrer und mit Bahn oder Bus, dann höchstens 4.500 € im Jahr.
  - Gilt nicht bei Firmenwagen oder Firmenbus (Sammelbeförderung).
- Auslöse der Firma (steuerfrei): pro Tag zuerst mit der Verpflegungspauschale verrechnen (höchstens bis 0). Ein Rest wird nur mit selbst bezahlter Übernachtung verrechnet, nie mit Fahrtkosten. Kilometergeld der Firma wird mit den Fahrtkosten verrechnet.
- Arbeitnehmer-Pauschbetrag 1.230 €. Gewerkschaftsbeiträge zählen ab 2026 zusätzlich.
- Fahrzeit (angerechnete Stunden für An- und Abreise) und Ausfallschichten zählen nur für die Stunden, nicht für die Steuer.

## „Deine Arbeit“ (Einstellungen, bleiben änderbar)

- Fahrzeug, fester Ort laut Vertrag, Auslöse (ganzer Tag, An- und Abreise, Tagestour), Unterkunft, Kilometergeld und ob Fahrzeit angerechnet wird.
- Diese Werte füllen neue Einträge vor. Gespeicherte Tage ändern sie nicht.
- Neue Nutzer starten ohne Auslöse. Daten aus den Versionen 1.0 bis 1.2 ohne `ausFull` bekommen 42 € / 21 € (Werte der Firma des Testers).

## Offene Punkte (Stand Version 1.3.1)

- Stufe 1:
  - Hinweis „Was ist neu“ nach Updates
  - PDF-Jahresbericht und Ausfüllhilfe für die Anlage N
  - Belegfotos
  - Zuschlagsstunden (Nacht, Sonntag, Feiertag nach § 3b EStG)
  - „Ganzer Tag“ verständlicher benennen
  - Feld für Nr. 20 der Lohnsteuerbescheinigung
- Stufe 2, vor dem Abo:
  - Konto und Cloud-Synchronisation (Server in der EU)
  - anderes Hosting, denn GitHub Pages erlaubt keinen kommerziellen Betrieb
  - Impressum, Datenschutzerklärung, Bezahlung
  - Version für den Play Store
  - Prüfung der Rechenlogik durch einen Steuerberater, mehr Tester
- Stufe 3: Teamversion für Sicherungsfirmen, Auslandspauschalen, mehrere Sprachen.
- Bekannte Lücke: Vertragsänderungen ab einem Datum (z. B. neuer Sammelpunkt ab Juli) lassen sich nicht abbilden.

## Sonstiges

- Urheberrecht beim Inhaber, `LICENSE`: alle Rechte vorbehalten. Die Seite ist für Suchmaschinen gesperrt (`noindex`).
- Keine persönlichen Daten wie E-Mail-Adressen in das Repository schreiben.
