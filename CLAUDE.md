# MontageBuch (früher SAKRA Schichtbuch) – Hinweise für Claude

## Was das ist

MontageBuch (bis Version 1.4 „Schichtbuch“) ist eine Web-App (PWA) für Sicherungsaufsichtskräfte und andere Beschäftigte im Gleisbau, die oft auf Montage sind. Man erfasst Arbeitstage, Schichten, An- und Abreise mit Fahrzeit, Montage, Fahrten, Auslöse und Ausgaben. Die App rechnet die Werbungskosten für die Anlage N aus, exportiert eine Excel-Datei und einen Jahresbericht zum Drucken oder als PDF (mit Ausfüllhilfe für die Anlage N).

- Live: https://alhotmanndevhub-code.github.io/Schichtbuch/
- Repository: `alhotmanndevhub-code/schichtbuch`, Branch `main`
- Nutzer: der Inhaber des Repositorys (kein Entwickler, schreibt Deutsch) und ein Freund als Tester. Später ist ein Abo geplant (etwa 1 € im Monat).

## Aufbau

- Die ganze App steht in `index.html` (HTML, CSS und JavaScript in einer Funktion). Kein Build-Schritt, kein Framework.
- `sw.js` ist der Service Worker: offline nutzbar, Hinweis „Neue Version verfügbar“ bei Updates.
- Keine fremden Server oder CDNs (Datenschutz). Schriften (`barlow-*.woff2`) und `exceljs.min.js` liegen im Repository.
- Daten liegen nur im `localStorage` des Geräts. Die Schlüssel heißen weiter „schichtbuch“, damit nichts verloren geht:
  - `sakra-schichtbuch-v1`: alle Einträge, Ausgaben, Einstellungen
  - `sakra-schichtbuch-v1-rev`: Speichernummer. `persist()` führt Änderungen aus zwei offenen Fenstern Eintrag für Eintrag zusammen, statt zu überschreiben.
  - `sakra-schichtbuch-v1-defekt`: Kopie unlesbarer Daten, bevor etwas überschrieben wird
  - `sakra-schichtbuch-v1-theme`: Hell, Dunkel oder „Wie am Handy“ (`light`, `dark`, `auto`), gilt nur für dieses Gerät, nicht in der Sicherung. Ein kleines Skript im `<head>` setzt `data-theme` schon vor dem ersten Bild.
- Design „Rail Command“ (seit 2.0.0): Farben, Abstände und Radien stehen als CSS-Variablen oben im `<style>`, Dunkel in `:root`, Hell in `:root[data-theme="light"]`. Komponenten nutzen nur die Rollen (`--bg`, `--surface`, `--ink`, `--accent` …), keine festen Farbwerte. Rot (`#D32F2F`) ist für Aktionen, Amber für Status. Schrift Barlow (Schriftzug Barlow 700 mit `-webkit-text-stroke`).
- Logo: zwei SVG-Symbole im Dokument, `#logo-d` (dunkler Grund) und `#logo-l` (heller Grund), nachgezeichnet nach `MontageBuch_Design_Pack/reference/reference_original.png`. App-Symbole (`icon-*.png`, `apple-touch-icon.png`, `favicon.svg`) sind daraus erzeugt. Das Design-Pack liegt nur lokal (in `.gitignore`).
- Symbole: Material Symbols Rounded (Gewicht 500) als SVG-Sammlung im Dokument (`#i-…`), Aufruf mit `ic('name')`. Lizenz in `LICENSE-MaterialSymbols-Apache.txt`. Neue Symbole von `fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/<name>/wght500/24px.svg` holen und als `<symbol>` ergänzen.
- Fotos `bg-start-handy.webp`, `bg-start-gross.webp` (Willkommen) und `einsatz.webp` (Startseite am PC). Sie kommen erst beim ersten Anzeigen in den Offline-Speicher. Neue Dateitypen müssen in `.github/workflows/pruefen.yml` in die `cp`-Zeile, sonst fehlen sie online.
- Ansichten (`show(v)`): `list` ist die Startseite, `cal` Kalender, `day` Tagesdetail, `all` alle Einträge, `stats` Auswertung mit Reitern (Übersicht, Anlage N, Stunden), `more` Export und Sicherung, `settings`, `form` (Erfassen in drei Schritten, `setStep()`), `exp`, `report`, `welcome` (nur ohne Daten und ohne Einrichtung). Unterseiten (`day`, `all`, `settings`) öffnet `go()` mit Eintrag im Verlauf, damit die Zurück-Taste des Handys passt. Klicks laufen über einen gemeinsamen Verteiler für `data-…`-Knöpfe. Ab 840 px Breite Seitenleiste statt unterer Leiste.
- Wichtige Hinweise (Sicherung fällig, Daten unlesbar, Entwurf) stehen auf der Startseite. „Was ist neu“, „Einrichten“ und „Installieren“ stehen unter der Glocke (`renderBell()`).
- Belegfotos liegen in IndexedDB (`sakra-schichtbuch-v1-belege`, Store `files`, Bild als ArrayBuffer). Einträge und Ausgaben speichern nur die Kennungen in `photos`. Fotos werden auf 1600 px verkleinert. Neue Fotos eines verworfenen Formulars werden gelöscht, beim Start räumt `photoGC()` Fotos ohne Bezug auf, die älter als einen Tag sind. Ohne IndexedDB ist das Feld ausgeblendet.
- Sicherung und Wiederherstellung als JSON-Datei (Export > Sicherung), seit Version 4 mit den Belegfotos als Base64 in `files`.
- `CHANGELOG` in `index.html` steuert den Hinweis „Was ist neu“. `S.seenVersion` merkt sich, was der Nutzer schon gesehen hat.
- Gesetzliche Werte stehen in der Tabelle `LAW` (je Steuerjahr). Firmen- und Personenwerte stehen in `S.settings` („Deine Arbeit“).

## Regeln bei Änderungen

1. Vor jedem Commit `npm test` ausführen. Die Tests in `tests/` laufen mit jsdom und einer festen Uhrzeit (13.10.2026, siehe `tests/helpers.js`). Neue Funktionen bekommen eigene Tests.
2. Bei jeder Änderung, die live geht, `APP_VERSION` in `index.html` und `VERSION` in `sw.js` gleich hochzählen (ein Test prüft das). Sonst bekommen installierte Apps das Update nicht. Für Änderungen, die Nutzer merken, einen Eintrag in `CHANGELOG` ergänzen.
3. Nutzerdaten dürfen nie verloren gehen. Den Speicherschlüssel nicht ändern. Alte Formate weiter lesen (`normEntry`, `mergeSettings`, `legacySettings`), z. B. den alten Typ `reise` oder Einstellungen ohne `ausFull`.
4. Handy zuerst: 360 px Breite ohne waagerechtes Scrollen, Hell- und Dunkelmodus prüfen, dazu Tablet (768 px) und PC (ab 840 px Seitenleiste). Geprüft wird im Browser-Fenster von Claude mit einem kleinen lokalen Server ohne Service Worker. Steuerlich falsche Inhalte aus dem Referenzbild (25-km-Grenze, Anlage-N-Zeilen 46–48, „rechtssicher“) nicht übernehmen.
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
- Nr. 20 der Lohnsteuerbescheinigung (steuerfreie Verpflegungszuschüsse) wird je Jahr in `S.settings.nr20` gespeichert. Ist sie eingetragen (auch 0), ersetzt sie die Schätzung der Verpflegungs-Verrechnung (`T.offV = min(Nr. 20, Pauschalen)`).
- Zuschlagsstunden § 3b EStG (`zMin`), nur Stunden: Nacht 20–6 Uhr 25 %, 0–4 Uhr 40 % bei Beginn vor 0 Uhr; Sonntag 50 %; Feiertag und 31.12. ab 14 Uhr 125 %; 24.12. ab 14 Uhr, 25./26.12., 1.5. 150 %. Bei Beginn vor 0 Uhr gilt der Sonntags-/Feiertagssatz auch für 0–4 Uhr des Folgetags. Sonntag und Feiertag nicht doppelt, Nacht zusätzlich. Pause anteilig, Ausfallschichten nicht. Feiertage nach Bundesland (Brandenburg: auch Oster- und Pfingstsonntag).
- Ausfüllhilfe (`anlageN`): Zeilen nach dem Formular Anlage N 2025 (27–34 Wege, 51, 53–56, 60, 62/64, 65–69, 71, 72–75, 77). Jedes Jahr mit dem neuen Formular abgleichen.

## „Deine Arbeit“ (Einstellungen, bleiben änderbar)

- Fahrzeug, fester Ort laut Vertrag, Auslöse (ganzer Tag, An- und Abreise, Tagestour), Unterkunft, Kilometergeld und ob Fahrzeit angerechnet wird.
- Diese Werte füllen neue Einträge vor. Gespeicherte Tage ändern sie nicht.
- Neue Nutzer starten ohne Auslöse. Daten aus den Versionen 1.0 bis 1.2 ohne `ausFull` bekommen 42 € / 21 € (Werte der Firma des Testers).

## Offene Punkte (Stand Version 2.0.0)

- Stufe 1 ist mit Version 1.4.0 erledigt: „Was ist neu“, Jahresbericht mit Ausfüllhilfe, Belegfotos, Zuschlagsstunden, „24 Std. auswärts“ statt „Ganzer Tag“, Nr. 20.
- Version 2.0.0: neuer Name MontageBuch, Design „Rail Command“ in Dunkel und Hell, Startseite, Kalender, Tagesdetail mit Kopie für den nächsten Tag, Erfassen in drei Schritten, Glocke, Seitenleiste am PC. Die Rechenlogik ist unverändert.
- Stufe 2, vor dem Abo:
  - Konto und Cloud-Synchronisation (Server in der EU)
  - anderes Hosting, denn GitHub Pages erlaubt keinen kommerziellen Betrieb
  - Impressum, Datenschutzerklärung, Bezahlung
  - Version für den Play Store
  - Prüfung der Rechenlogik durch einen Steuerberater, mehr Tester
- Stufe 3: Teamversion für Sicherungsfirmen, Auslandspauschalen, mehrere Sprachen.
- Bekannte Lücken: Vertragsänderungen ab einem Datum (z. B. neuer Sammelpunkt ab Juli) lassen sich nicht abbilden. Feiertage richten sich nach dem Bundesland in den Einstellungen, nicht nach dem Einsatzort.

## Sonstiges

- Urheberrecht beim Inhaber, `LICENSE`: alle Rechte vorbehalten. Die Seite ist für Suchmaschinen gesperrt (`noindex`).
- Keine persönlichen Daten wie E-Mail-Adressen in das Repository schreiben.
