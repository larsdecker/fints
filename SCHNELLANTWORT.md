# Schnellantwort: npm-Veröffentlichung unter neuem Namen

## Projekt-Übersicht

**fints** ist eine TypeScript-Bibliothek für Online-Banking über das FinTS/HBCI-Protokoll mit diesen Hauptfunktionen:

- Kontoauszüge und Transaktionen abrufen
- SEPA-Überweisungen und Lastschriften
- TAN-Verwaltung
- MT940-Parsing
- PSD2-Unterstützung

## Was zu tun ist für npm-Veröffentlichung unter neuem Namen

### Schnellübersicht (5 Schritte):

1. **Namen ändern** in `packages/fints/package.json` und `packages/fints-cli/package.json`
2. **Repository-URLs** aktualisieren (author, contributors, repository)
3. **README-Dateien** anpassen (3 Dateien)
4. **Build & Test** durchführen (`make build && make test`)
5. **Veröffentlichen** mit `yarn lerna publish`

### Empfohlene neue Funktionen:

#### Kritische Verbesserungen (Priorität 1):
- ✅ **node-expat/cxsd Problem beheben** - Veraltete XML-Dependencies ersetzen
- ✅ **tslint → eslint migrieren** - tslint ist deprecated
- ✅ **Dependencies aktualisieren** - Sicherheitswarnungen beheben
- ✅ **ESM-Support** - Native ES-Module hinzufügen

#### Banking-Features (Priorität 2):
- 📋 Daueraufträge verwalten
- 📈 Wertpapiergeschäfte
- 💳 Kreditkartenumsätze
- 📅 Terminüberweisungen
- 📊 Sammelüberweisungen

#### Developer Experience (Priorität 3):
- 🔧 Vollständige TypeScript 5.x Types
- 📝 Bessere Dokumentation mit Beispielen
- 🐛 Strukturierte Error-Klassen
- 🎯 Konfigurierbare Logging-Level

## Vollständige Dokumentation

Für detaillierte Anweisungen siehe:
- **[PROJEKT_UEBERSICHT.md](PROJEKT_UEBERSICHT.md)** (Deutsch, vollständig)
- **[PUBLISHING_GUIDE.md](PUBLISHING_GUIDE.md)** (English, quick reference)

## Wichtiger Hinweis

⚠️ Vor produktiver Nutzung: Registrierung bei der Deutschen Kreditwirtschaft erforderlich (kann mehrere Wochen dauern).
