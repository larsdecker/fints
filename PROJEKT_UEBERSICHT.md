# Projekt-Übersicht: fints

## Was ist dieses Projekt?

**fints** ist eine TypeScript/JavaScript-Bibliothek für die Kommunikation mit FinTS-Servern (Financial Transaction Services, früher HBCI). FinTS ist ein in Deutschland weit verbreiteter Standard für Online-Banking.

### Hauptfunktionen

Die Bibliothek ermöglicht folgende Funktionen:

- **Kontoverwaltung**: Abrufen aller Konten eines Benutzers
- **Kontoauszüge**: Abrufen von Transaktionen und Kontoauszügen für bestimmte Zeiträume
- **Kontostände**: Aktuelle Kontostände abfragen
- **Depot-Bestände**: Wertpapierdepots einsehen
- **SEPA-Überweisungen**: Überweisungen initiieren (pain.001 Format) mit TAN-Verwaltung
- **SEPA-Lastschriften**: Lastschriften einreichen (pain.008 Format) mit TAN-Verwaltung
- **MT940-Parser**: Kontoauszüge im MT940-Format parsen
- **TAN-Verfahren**: Unterstützung verschiedener TAN-Methoden
- **PSD2-Unterstützung**: Kompatibel mit PSD2-Anforderungen

### Projektstruktur

Das Projekt ist als **Monorepo** mit Lerna organisiert und enthält zwei Pakete:

1. **`fints`** (`packages/fints/`)
   - Die Hauptbibliothek
   - Geschrieben in TypeScript
   - Version: 0.5.0
   - Kann in Node.js und Browser-Umgebungen verwendet werden

2. **`fints-cli`** (`packages/fints-cli/`)
   - Ein Kommandozeilen-Tool für FinTS-Operationen
   - Version: 0.1.7
   - Ermöglicht Banking-Operationen über die Konsole

### Technologie-Stack

- **Sprache**: TypeScript
- **Build-System**: TypeScript Compiler, Lerna für Monorepo-Verwaltung
- **Test-Framework**: Jest
- **Linting**: TSLint
- **Paket-Manager**: Yarn (mit Workspaces)
- **Wichtige Abhängigkeiten**:
  - `date-fns` für Datumsverarbeitung
  - `mt940-js` für MT940-Parsing
  - `fast-xml-parser` für XML-Verarbeitung
  - `winston` für Logging
  - `isomorphic-fetch` für HTTP-Anfragen

## Veröffentlichung unter einem neuen Namen auf npm

Wenn Sie dieses Projekt unter einem neuem Namen auf npm veröffentlichen möchten, müssen Sie folgende Schritte durchführen:

### 1. Paket-Namen ändern

#### Hauptpaket (`packages/fints/package.json`):
```json
{
  "name": "ihr-neuer-paketname",
  "version": "1.0.0",
  ...
}
```

#### CLI-Paket (`packages/fints-cli/package.json`):
```json
{
  "name": "ihr-neuer-paketname-cli",
  "version": "1.0.0",
  "dependencies": {
    "ihr-neuer-paketname": "^1.0.0",
    ...
  }
}
```

### 2. Repository-Informationen aktualisieren

In beiden `package.json` Dateien:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/IhrUsername/ihr-repo-name"
  }
}
```

### 3. README-Dateien aktualisieren

- `/README.md` - Haupt-README
- `/packages/fints/README.md` - Bibliotheks-README
- `/packages/fints-cli/README.md` - CLI-README

Aktualisieren Sie:
- Projekt-Namen
- npm-Badge URLs
- Installationsanweisungen (`npm install ihr-neuer-paketname`)
- Import-Beispiele
- Links zu Repository und Dokumentation

### 4. Dokumentation aktualisieren

- Badge URLs in allen READMEs
- API-Dokumentations-Links
- Repository-Links

### 5. Import-Statements prüfen

Stellen Sie sicher, dass interne Imports korrekt sind, besonders in:
- `packages/fints-cli/` (sollte auf den neuen Namen verweisen)

### 6. Autor-Informationen aktualisieren

In beiden `package.json` Dateien:
```json
{
  "author": "Ihr Name",
  "contributors": [
    {
      "name": "Ihr Name",
      "email": "ihre@email.com",
      "url": "https://ihre-website.com"
    }
  ]
}
```

### 7. npm-Account vorbereiten

```bash
# Bei npm anmelden
npm login

# Paket-Namen Verfügbarkeit prüfen
npm search ihr-neuer-paketname
```

### 8. Build und Test

```bash
# Dependencies installieren
yarn install

# Projekt bauen
make build

# Tests ausführen
make test

# Linting
make lint
```

### 9. Veröffentlichen

```bash
# Mit Lerna veröffentlichen (empfohlen für Monorepo)
yarn lerna publish

# Oder manuell für jedes Paket
cd packages/fints
npm publish

cd ../fints-cli
npm publish
```

### 10. Wichtige Hinweise

**⚠️ Rechtliche Hinweise:**
- Beachten Sie die MIT-Lizenz des Original-Projekts
- Fügen Sie entsprechende Attributionen hinzu
- Dokumentieren Sie Ihre Änderungen

**📝 Registrierung bei der Deutschen Kreditwirtschaft:**
- Für die produktive Nutzung müssen Sie Ihre Anwendung bei der Deutschen Kreditwirtschaft registrieren
- Sie benötigen eine Registrierungsnummer
- Dieser Prozess kann mehrere Wochen dauern

## Neue Funktionen für eine Fork-Version

Wenn Sie das Projekt unter einem neuen Namen veröffentlichen, könnten Sie folgende neue Funktionen hinzufügen:

### 1. Modernisierung der Dependencies

- **node-gyp Problem beheben**: Das aktuelle Projekt hat Probleme mit `node-expat` / `cxsd`
  - Alternative XML-Parsing-Lösung implementieren
  - Neuere, wartbare Dependencies verwenden

- **Veraltete Pakete aktualisieren**:
  - `tslint` → `eslint` migrieren (tslint ist deprecated)
  - Veraltete dependencies aktualisieren (tough-cookie, har-validator, etc.)

### 2. Erweiterte Banking-Funktionen

- **Daueraufträge verwalten**: Einrichten, ändern, löschen
- **Wertpapiergeschäfte**: Kauf/Verkauf von Wertpapieren
- **Kreditkartenabfragen**: Kreditkartenumsätze abrufen
- **Terminüberweisungen**: Überweisungen mit zukünftigem Datum
- **Sammelüberweisungen**: Mehrere Überweisungen auf einmal

### 3. Verbesserte TAN-Verfahren

- **Bessere pushTAN-Unterstützung**
- **photoTAN-Unterstützung**
- **FIDO2/WebAuthn-Integration** für modernere Authentifizierung
- **TAN-less Operationen** wo möglich (PSD2)

### 4. Entwickler-Erfahrung verbessern

- **TypeScript 5.x optimieren**: Neueste TypeScript-Features nutzen
- **Bessere Type Definitions**: Vollständigere und genauere Typen
- **Async/Await durchgehend**: Konsistente Promise-basierte API
- **Error Handling**: Strukturiertere Error-Klassen und bessere Fehlerbehandlung
- **Logging-Levels**: Konfigurierbare Logging-Level

### 5. Neue Export-Formate

- **ESM-Unterstützung**: Native ES-Module zusätzlich zu CommonJS
- **Tree-shaking Optimierung**: Bessere Bundle-Größen
- **Separate Builds**: Browser und Node.js optimierte Builds

### 6. Testing und Qualität

- **Höhere Test-Coverage**: Mehr Unit- und Integrationstests
- **E2E-Tests**: Tests mit Demo-Servern
- **Performance-Tests**: Benchmarks für kritische Operationen
- **Security-Scanning**: Automatisierte Sicherheitsprüfungen

### 7. Dokumentation

- **Interaktive Dokumentation**: Mit Playground-Beispielen
- **Multi-Language Support**: Dokumentation auf Deutsch und Englisch
- **Video-Tutorials**: Einführungsvideos
- **Migration Guide**: Von anderen FinTS-Bibliotheken
- **Bank-spezifische Guides**: Anleitungen für verschiedene Banken

### 8. CLI-Verbesserungen

- **Interaktiver Modus**: TUI (Terminal UI) für bessere Benutzerführung
- **Konfigurationsprofile**: Mehrere Bank-Zugänge verwalten
- **Export-Funktionen**: CSV, JSON, Excel-Export von Transaktionen
- **Reporting**: Automatische Berichte und Statistiken

### 9. Zusätzliche Features

- **Webhook-Support**: Benachrichtigungen bei neuen Transaktionen
- **Transaction Categorization**: Automatische Kategorisierung von Ausgaben
- **Budget-Tracking**: Eingebaute Budget-Verwaltung
- **Multi-Banking**: Mehrere Banken gleichzeitig verwalten
- **Data Visualization**: Charts und Grafiken für Finanzdaten

### 10. PSD2 und Open Banking

- **XS2A-Support**: Erweiterte PSD2-Funktionen
- **Consent Management**: Bessere Verwaltung von PSD2-Consents
- **API-Gateway**: REST-API Wrapper für die FinTS-Funktionen
- **OAuth2-Integration**: Für moderne Authentifizierung

### 11. Sicherheit

- **Verschlüsselter Storage**: Sichere Speicherung von Zugangsdaten
- **Hardware-Token Support**: Unterstützung für Hardware-Sicherheitsmodule
- **Audit-Logging**: Vollständige Protokollierung aller Operationen
- **Rate Limiting**: Schutz vor zu vielen Anfragen

### 12. Performance

- **Caching**: Intelligentes Caching von Kontoinformationen
- **Batch-Operations**: Mehrere Operationen gleichzeitig
- **Connection Pooling**: Effizientere Verbindungsverwaltung

## Empfohlener Veröffentlichungs-Workflow

1. **Fork erstellen**: Repository forken
2. **Namen ändern**: Alle Namen und Referenzen aktualisieren
3. **Erste Änderungen**: Kritische Bugs und Dependencies fixen
4. **Version 1.0.0**: Erste stabile Version mit aktualisierten Dependencies
5. **Neue Features**: Schrittweise neue Funktionen hinzufügen
6. **Community**: Community aufbauen, Issues beantworten
7. **Iteration**: Regelmäßige Updates und Verbesserungen

## Nützliche Befehle

```bash
# Installation
yarn install

# Bauen
make build

# Tests
make test

# Linting
make lint

# Dokumentation generieren
make docs

# Cleanup
make clean

# Veröffentlichen (nach successful build und test)
make publish
```

## Lizenz-Hinweis

Das Original-Projekt steht unter der MIT-Lizenz. Wenn Sie eine Fork-Version erstellen:

1. Behalten Sie die Original-Lizenz bei
2. Fügen Sie Ihre eigenen Copyright-Hinweise hinzu
3. Dokumentieren Sie klar, dass es sich um eine Fork handelt
4. Geben Sie Kredit an die Original-Autoren

## Weitere Ressourcen

- **FinTS Spezifikation**: https://www.hbci-zka.de/spec/3_0.htm
- **FinTS Institute DB**: https://github.com/jhermsmeier/fints-institute-db
- **MT940 Format**: https://en.wikipedia.org/wiki/MT940
- **PSD2 Information**: https://www.europeanpaymentscouncil.eu/what-we-do/psd2

## Kontakt und Support

Für Fragen zum Original-Projekt:
- GitHub: https://github.com/Prior99/fints
- Author: Frederick Gnodtke

Für Ihre Fork-Version sollten Sie:
- Eigene Issue-Tracker einrichten
- Eigene Support-Kanäle definieren
- Community-Guidelines erstellen
