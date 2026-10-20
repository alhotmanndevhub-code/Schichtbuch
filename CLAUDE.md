# MontageBuch (früher SAKRA Schichtbuch) – Hinweise für Claude

## Was das ist

MontageBuch (bis Version 1.4 „Schichtbuch“) ist eine Web-App (PWA) für Sicherungsaufsichtskräfte und andere Beschäftigte im Gleisbau, die oft auf Montage sind. Man erfasst Arbeitstage, Schichten, An- und Abreise mit Fahrzeit, Montage, Fahrten, Auslöse und Ausgaben. Die App rechnet die Werbungskosten für die Anlage N aus, exportiert eine Excel-Datei und einen Jahresbericht zum Drucken oder als PDF (mit Ausfüllhilfe für die Anlage N).

- Live: https://alhotmanndevhub-code.github.io/Schichtbuch/
- Repository: `alhotmanndevhub-code/schichtbuch`, Branch `main`
- Nutzer: der Inhaber des Repositorys (kein Entwickler, schreibt Deutsch) und ein Freund als Tester. Später ist ein Abo geplant (etwa 1 € im Monat).

## Aufbau

- Die ganze App steht in `index.html` (HTML, CSS und JavaScript in einer Funktion). Kein Build-Schritt, kein Framework.
- `sw.js` ist der Service Worker: offline nutzbar, Hinweis „Neue Version verfügbar“ bei Updates.
- Keine fremden Server oder CDNs (Datenschutz). Schriften (`barlow-*.woff2`) und `exceljs.min.js` liegen im Repository. `exceljs.min.js` ist byte-gleich mit `dist/exceljs.min.js` aus exceljs 4.4.0 (ein Test vergleicht mit `node_modules`).
- Content-Security-Policy (seit 2.3.1) als `<meta>` im `<head>`: Skripte, Bilder, Schriften und Verbindungen nur von der eigenen Seite. Die beiden Skripte in `index.html` sind über sha256-Prüfsummen freigegeben. Nach jeder Änderung an einem Skript `npm run csp` ausführen, sonst blockiert der Browser die App (`tests/sicherheit.test.js` prüft das). Keine `on…=`-Attribute, kein `javascript:`, kein `eval`. `'unsafe-inline'` nur für Stile.
- Fremde Daten kommen nur über eine Sicherungsdatei. Alles läuft durch `normEntry`, `normExp`, `mergeSettings`: Texte über `txt()` (nur Text oder Zahl, begrenzt), Zahlen über `lim()` (0 bis 1 Mio., Minuten bis 1440), Auswahlwerte über `has()` (nur eigene Schlüssel, nicht `constructor`). Text in `innerHTML` immer mit `esc()`. Belege nur als Foto oder PDF (`okType`, `safeType`), alles andere, auch SVG, gilt als einfache Datei. „Tabelle kopieren“ setzt vor Text mit `= + - @` ein Hochkomma, damit Excel keine Formel ausführt.
- Daten liegen nur im `localStorage` des Geräts. Die Schlüssel heißen weiter „schichtbuch“, damit nichts verloren geht:
  - `sakra-schichtbuch-v1`: alle Einträge, Ausgaben, Einstellungen
  - `sakra-schichtbuch-v1-rev`: Speichernummer. `persist()` führt Änderungen aus zwei offenen Fenstern Eintrag für Eintrag zusammen, statt zu überschreiben.
  - `sakra-schichtbuch-v1-defekt`: Kopie unlesbarer Daten, bevor etwas überschrieben wird
  - `sakra-schichtbuch-v1-theme`: Hell, Dunkel oder „Wie am Handy“ (`light`, `dark`, `auto`), gilt nur für dieses Gerät, nicht in der Sicherung. Ein kleines Skript im `<head>` setzt `data-theme` schon vor dem ersten Bild.
- Design „Rail Command“ (seit 2.0.0): Farben, Abstände und Radien stehen als CSS-Variablen oben im `<style>`, Dunkel in `:root`, Hell in `:root[data-theme="light"]`. Komponenten nutzen nur die Rollen (`--bg`, `--surface`, `--ink`, `--accent` …), keine festen Farbwerte. Schrift Barlow (Schriftzug Barlow 700 mit `-webkit-text-stroke`).
- Signalfarben (seit 2.2.0) überall gleich wie die Lampen (`.lamp`): Grün = erfasst oder in Ordnung, Gelb = bitte prüfen, Rot = fehlt oder die eine Hauptaktion eines Bildschirms (`.btn.primary`, „Neuer Eintrag“). Gewählte Knöpfe, aktive Navigation, heute im Kalender und Links sind hell auf dunkel bzw. dunkel auf hell (`--ink`), nicht rot. Kategorien (Ring, Kalenderpunkte) nutzen Blau, Magenta, Violett, Türkis ohne Signalfarben (mit dem Farbfehlsichtigkeits-Check des dataviz-Skills geprüft), nur „Arbeitstag erfasst“ ist grün. Keine farbigen Randstreifen, keine gesperrten Großbuchstaben; Rangfolge über Größe und Gewicht (`.blk-h` Blocktitel, `.flbl` Feldbeschriftung).
- Erklärungen auf Abruf (seit 2.2.0): Erklärtexte haben die Klasse `tip` und eine `id`, der Titel davor `data-tip="id"`; daraus entsteht das Info-Zeichen (`.ib`, Symbol `#i-info`). In gerenderten Inhalten `withTip(text, id)` nutzen. `syncTips()` blendet das Zeichen aus, wenn es nichts zu erklären gibt, `resetTips()` klappt beim Öffnen eines Formulars alles zu. Echte Warnungen sind `.warn` (Zeile mit gelber Lampe) und stehen nie hinter dem Zeichen.
- Seltene Auswahl (seit 2.2.0): `rare` in `SEGS` legt fest, was hinter „Mehr“ steht (Art: Schulung, Frei, Urlaub, Krank; Schicht: Ausfall; Auswärts nach dem Vortag, `nightBefore()`; Fahrzeug außer dem aus „Deine Arbeit“). Die gewählte Auswahl bleibt immer sichtbar, `foldSegs()` klappt beim nächsten Formular wieder zu.
- Logo: zwei SVG-Symbole im Dokument, `#logo-d` (dunkler Grund) und `#logo-l` (heller Grund), nachgezeichnet nach `MontageBuch_Design_Pack/reference/reference_original.png`. App-Symbole (`icon-*.png`, `apple-touch-icon.png`, `favicon.svg`) sind daraus erzeugt. Das Design-Pack liegt nur lokal (in `.gitignore`).
- Symbole: Material Symbols Rounded (Gewicht 500) als SVG-Sammlung im Dokument (`#i-…`), Aufruf mit `ic('name')`. Lizenz in `LICENSE-MaterialSymbols-Apache.txt`. Neue Symbole von `fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/<name>/wght500/24px.svg` holen und als `<symbol>` ergänzen.
- Fotos `bg-start-handy.webp`, `bg-start-gross.webp` (Willkommen) und `einsatz.webp` (Startseite am PC). Sie kommen erst beim ersten Anzeigen in den Offline-Speicher. Neue Dateitypen müssen in `.github/workflows/pruefen.yml` in die `cp`-Zeile, sonst fehlen sie online.
- Ansichten (`show(v)`): `list` ist die Startseite, `cal` Kalender, `day` Tagesdetail, `all` alle Einträge, `stats` Auswertung mit Reitern „Arbeit“ und „Steuer“ (seit 2.4.0, siehe unten), `more` Export und Sicherung, `settings`, `form` (Erfassen in drei Schritten, `setStep()`), `exp`, `report`, `welcome` (nur ohne Daten und ohne Einrichtung), `setup` (Einrichten in drei Fragen). Unterseiten (`day`, `all`, `settings`, `setup`) öffnet `go()` mit Eintrag im Verlauf, damit die Zurück-Taste des Handys passt. Klicks laufen über einen gemeinsamen Verteiler für `data-…`-Knöpfe. Ab 840 px Breite Seitenleiste statt unterer Leiste.
- Startseite (seit 2.1.0, `renderHome()`): oben „Heute“ (`todayHTML`) mit dem Knopf „Wie gestern übernehmen“ (`quickSave`, nutzt dieselbe Vorbelegung `prefill` wie das Formular, danach „Rückgängig“), darunter „Diese Woche“ als Gleis mit Signallampen (`weekHTML`: grün erfasst, gelb heute offen, rot fehlt laut `missingWorkdays`, grau frei oder später), dann „Dieser Monat“ mit Tagen, Stunden und Auslöse (`monthHTML`, Tipp öffnet „Arbeit“), Einsatz und letzte Einträge.
- Wochengleis (seit 2.5.0, `weekHTML`, `wkMotion`): Gerade neu gespeicherte Tage (`justSaved.add`, bei mehreren Tagen `justSaved.dates`) stehen zuerst auf „aus“ (`arrive`). Ein Lichtpunkt (`.wk-light`, Web Animations) fährt vom letzten erfassten Tag der Woche hin, dann gehen Lampe und Schwelle an (`pop`). Macht der Eintrag die Woche komplett (`data-full`), hüpfen die grünen Schwellen nacheinander. Ändern eines Tages zeigt nur `pop`. Ohne `Element.animate`, ohne Größe (verdeckt) oder bei „Bewegung reduzieren“ gehen die Lampen sofort an (so laufen auch die jsdom-Tests). Beim Öffnen der App gehen die Lampen einmal nacheinander an (`.wk.test`, `lampTested` wird erst nach dem Start gesetzt, weil die Startseite beim Start zweimal gezeichnet wird).
- Montage als Leiste (seit 2.5.0): `montageBlocks(list)` bildet Blöcke aus Tagen mit `away` an/voll/ab (Abreise beendet, Anreise beginnt einen Block; pro Tag der Eintrag mit Auslöse; bis zu drei ganz leere Tage dazwischen werden Lücken `gap`). `mtInfo` rechnet Auslöse, „prüfen“ (wie `awayGroups`) und den Vorschlag (`autoAllow`, sonst häufigster Betrag im Block). `mtHTML` zeichnet die Felder (`.mt-car`: `an` mit runder Nase, `ab` mit rotem Schlusslicht, `chk` gelb, `gap` gestrichelt mit `data-new`, `out` blass für andere Monate). Tipp auf ein Feld (`data-mt`, `mtToggle`) klappt die Angaben darunter auf, ohne neu zu zeichnen; „… eintragen“ (`data-mtfix`, `mtFix`) setzt die fehlende Auslöse mit „Rückgängig“. Auf der Startseite steht die Leiste in „Aktueller Einsatz“ (`jobHTML`, `jobMontage`: letzter Block im Zeitraum des Einsatzes, höchstens eine Woche alt; dann gilt dessen Zeitraum und dessen Summe), unter „Arbeit“ jede Montage des Monats in „Montage und Auslöse“ (`mtMonthHTML`).
- Auswertung (seit 2.4.0, `renderStats()`): Reiter „Arbeit“ (`workHTML`) zeigt einen Monat (`workM`, blättern mit `data-wm`) so, wie er auf der Lohnabrechnung steht: Tage, Stunden, Nacht-, Sonntags- und Feiertagsstunden, Montagetage als Leiste und nach Art und Auslöse (`mtMonthHTML`, `awayGroups`, gelb „prüfen“, wenn Auslöse fehlt, obwohl die Firma laut „Deine Arbeit“ zahlt oder an anderen Tagen derselben Art etwas eingetragen ist), Fahrten, Übernachtungen, Urlaub, Krank. Dazu der Monatsnachweis als PDF (`openReport(from, monat)`, `monthReportHTML`) und darunter das ganze Jahr. Reiter „Steuer“ (`taxHTML`) beginnt mit der Antwort, ob die Steuererklärung etwas bringt (Vergleich mit dem Arbeitnehmer-Pauschbetrag), dann „So rechnet das Finanzamt“ in einfachen Worten; Ausfüllhilfe Anlage N, Nr. 20, alle Einzelbeträge und „So rechnet MontageBuch“ sind eingeklappt (`details[data-keep]`, bleiben nach dem neuen Zeichnen offen).
- Grundsatz seit 2.4.0 (Wunsch des Inhabers): Alles, was mit Steuer zu tun hat (Pauschalen, Werbungskosten, Pauschbetrag, Anlage N), steht nur unter Auswertung > Steuer, im Jahresbericht und in Excel. Startseite, Listen, Kalender, Tagesdetail und „Arbeit“ zeigen nur Arbeit und Geld von der Firma (Stunden, Auslöse, Kilometer). Die Nutzer sind einfache Leute ohne Steuerkenntnisse, die App soll entlasten und nicht verwirren.
- Erster Start (seit 2.3.0): „Los geht’s“ und „Jetzt einrichten“ unter der Glocke öffnen `openSetup()`. Drei Fragen (`SU_Q`): Fahrzeug mit Bundesland, fester Ort laut Vertrag (mit Name und Entfernung), Auslöse (mit den drei Beträgen). Jede Antwort landet sofort über `suSet()` in `S.settings`; erst „Fertig“ oder „Überspringen“ setzt `profSeen`. Danach zeigt die leere Startseite „Heute“ mit „Ersten Arbeitstag erfassen“. Unterkunft, Kilometergeld, Fahrzeit, Name und Schichtzeiten bleiben auf der Einstellungsseite.
- Wichtige Hinweise (Daten unlesbar, Entwurf) stehen oben auf der Startseite, die Erinnerung an die Sicherung unter der Woche (`backupCard`). „Was ist neu“, „Einrichten“ und „Installieren“ stehen unter der Glocke (`renderBell()`).
- Bewegung (seit 2.1.0): `enter()` lässt Ansichten hereingleiten (Richtung über `navDir`: Unterseiten von rechts, zurück von links, Formulare von unten). Drück-Effekte und Animationen stehen nur in `@media (prefers-reduced-motion:no-preference)`, `reduceMotion()` prüft das auch im Skript. `buzz()` vibriert kurz beim Speichern und Löschen (nur Android). `countUp()` zählt die Auslöse in „Dieser Monat“ und die Summe der Montage hoch, wenn sie sich seit dem letzten Blick geändert hat (jedes Feld für sich). Beim ersten Öffnen reihen sich die Tage der Montage ein (`.mt.in`), neu gespeicherte Tage kommen als neuer Wagen dazu (`.mt-car.new`). Löschen zeigt „Rückgängig“; die Belegfotos werden vorher eingelesen und beim Rückgängig wieder abgelegt.
- Belegfotos liegen in IndexedDB (`sakra-schichtbuch-v1-belege`, Store `files`, Bild als ArrayBuffer). Einträge und Ausgaben speichern nur die Kennungen in `photos`. Fotos werden auf 1600 px verkleinert. Neue Fotos eines verworfenen Formulars werden gelöscht, beim Start räumt `photoGC()` Fotos ohne Bezug auf, die älter als einen Tag sind. Ohne IndexedDB ist das Feld ausgeblendet.
- Sicherung und Wiederherstellung als JSON-Datei (Export > Sicherung), seit Version 4 mit den Belegfotos als Base64 in `files`.
- `CHANGELOG` in `index.html` steuert den Hinweis „Was ist neu“. `S.seenVersion` merkt sich, was der Nutzer schon gesehen hat.
- Gesetzliche Werte stehen in der Tabelle `LAW` (je Steuerjahr). Firmen- und Personenwerte stehen in `S.settings` („Deine Arbeit“).

## Regeln bei Änderungen

1. Vor jedem Commit `npm test` ausführen, nach Änderungen an einem Skript in `index.html` vorher `npm run csp`. Die Tests in `tests/` laufen mit jsdom und einer festen Uhrzeit (13.10.2026, siehe `tests/helpers.js`). Neue Funktionen bekommen eigene Tests.
2. Bei jeder Änderung, die live geht, `APP_VERSION` in `index.html` und `VERSION` in `sw.js` gleich hochzählen (ein Test prüft das). Sonst bekommen installierte Apps das Update nicht. Für Änderungen, die Nutzer merken, einen Eintrag in `CHANGELOG` ergänzen.
3. Nutzerdaten dürfen nie verloren gehen. Den Speicherschlüssel nicht ändern. Alte Formate weiter lesen (`normEntry`, `mergeSettings`, `legacySettings`), z. B. den alten Typ `reise` oder Einstellungen ohne `ausFull`.
4. Handy zuerst: 360 px Breite ohne waagerechtes Scrollen, Hell- und Dunkelmodus prüfen, dazu Tablet (768 px) und PC (ab 840 px Seitenleiste). Geprüft wird im Browser-Fenster von Claude mit einem kleinen lokalen Server ohne Service Worker. Steuerlich falsche Inhalte aus dem Referenzbild (25-km-Grenze, Anlage-N-Zeilen 46–48, „rechtssicher“) nicht übernehmen.
5. Texte auf Deutsch, in Du-Form und einfacher Sprache. Die Nutzer sind keine Steuerexperten.
6. Nach dem Hochladen prüfen, ob die Live-Seite die neue Version ausliefert (`sw.js` abrufen).
7. Der Inhaber möchte vor größeren Änderungen gefragt werden und danach kurz hören, was sich geändert hat.
8. Beim Entfernen von Stilen nur die gemeinten Zeilen löschen und die Nachbarn prüfen. In 2.4.0 gingen so die Stile der Einsatz-Karte am Handy und von „Letzte Einträge“ verloren. `tests/gleis-montage.test.js` prüft diese Grundstile.

## Veröffentlichen

- Die GitHub Action `.github/workflows/pruefen.yml` lässt bei jedem Push die Tests laufen. Die Actions sind auf feste Commit-Kennungen gepinnt (Version im Kommentar dahinter). Für ein Update die Kennung des neuen Tags eintragen, z. B. mit `git ls-remote --tags https://github.com/actions/checkout`.
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

## Offene Punkte (Stand Version 2.5.0)

- Stufe 1 ist mit Version 1.4.0 erledigt: „Was ist neu“, Jahresbericht mit Ausfüllhilfe, Belegfotos, Zuschlagsstunden, „24 Std. auswärts“ statt „Ganzer Tag“, Nr. 20.
- Version 2.0.0: neuer Name MontageBuch, Design „Rail Command“ in Dunkel und Hell, Startseite, Kalender, Tagesdetail mit Kopie für den nächsten Tag, Erfassen in drei Schritten, Glocke, Seitenleiste am PC. Die Rechenlogik ist unverändert.
- Version 2.1.0 (nach der Design-Kritik vom 19.10.2026, Bericht in `.impeccable/critique/`, nur lokal): Paket A „App-Gefühl“ (Bewegung, Drück-Effekte, Vibrieren, Rückgängig nach dem Löschen) und Paket B „neue Startseite“.
- Version 2.2.0: Paket C „Aufräumen“ (Erklärungen hinter dem Info-Zeichen, seltene Auswahl hinter „Mehr“, Signalfarben mit fester Bedeutung, keine Randstreifen und gesperrten Großbuchstaben, dunkle Karten im Tagesdetail).
- Version 2.3.0: Paket D „Erster Start“ (Einrichten in drei Fragen, leere Startseite führt zum ersten Arbeitstag). Damit sind alle vier Pakete aus der Design-Kritik umgesetzt.
- Version 2.3.1: Sicherheits-Check ohne sichtbare Änderung für Nutzer (Content-Security-Policy, Sicherungsdateien streng geprüft, Belege nur als Foto oder PDF, Schutz vor Excel-Formeln beim Kopieren, Service Worker speichert nur die App, Actions gepinnt).
- Version 2.4.0: Auswertung in „Arbeit“ (Monat zum Vergleich mit der Lohnabrechnung, Monatsnachweis als PDF) und „Steuer“ (klare Antwort zuerst), „Dieser Monat“ auf der Startseite, Auslöse statt Verpflegungspauschale in Liste, Kalender und Tagesdetail. Anlass: Ein Tester mit 42 €/21 € Auslöse fand die Steuerzahlen verwirrend. Offen: Die Rechnungshinweise im Formular (Schritt „Zeiten“) zeigen noch Pauschalen; ob der Teil der Auslöse über der Pauschale mit selbst bezahlter Übernachtung verrechnet werden darf, sollte ein Steuerberater bestätigen.
- Version 2.5.0 (nach einer Ideenrunde vom 20.10.2026, Beispiele 1 und 2 „schlicht, passend zur App, mit kleinen Bewegungen“): Wochengleis mit Lichtpunkt und Lampentest, Montage als Leiste mit „… eintragen“. Repariert: Stile der Einsatz-Karte am Handy und von „Letzte Einträge“ (fehlten seit 2.4.0), `--amber-ink` für „prüfen“. Noch nicht gebaut aus derselben Runde: Schicht als Uhr (24-Stunden-Ring mit Nachtstunden), Jahr als Linienplan der Einsatzorte, Jahresrückblick, Wischen in der Liste. Bilder und Abzeichen hat der Inhaber gestrichen.
- Stufe 2, vor dem Abo:
  - Konto und Cloud-Synchronisation (Server in der EU)
  - anderes Hosting, denn GitHub Pages erlaubt keinen kommerziellen Betrieb
  - Impressum, Datenschutzerklärung, Bezahlung
  - Version für den Play Store
  - Prüfung der Rechenlogik durch einen Steuerberater, mehr Tester
- Stufe 3: Teamversion für Sicherungsfirmen, Auslandspauschalen, mehrere Sprachen.
- Bekannte Lücken: Vertragsänderungen ab einem Datum (z. B. neuer Sammelpunkt ab Juli) lassen sich nicht abbilden. Feiertage richten sich nach dem Bundesland in den Einstellungen, nicht nach dem Einsatzort. Alle GitHub-Pages-Seiten eines Kontos teilen sich die Adresse alhotmanndevhub-code.github.io und damit localStorage und IndexedDB: Bis zum eigenen Hosting keine weitere Seite unter diesem Konto veröffentlichen.

## Sonstiges

- Urheberrecht beim Inhaber, `LICENSE`: alle Rechte vorbehalten. Die Seite ist für Suchmaschinen gesperrt (`noindex`).
- Keine persönlichen Daten wie E-Mail-Adressen in das Repository schreiben.
