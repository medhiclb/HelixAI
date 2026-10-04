<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.png" />
    <img src="docs/images/logo-light.png" alt="Logo von Helix AI" height="120" />
  </picture>
</p>

<h1 align="center">Helix AI</h1>

<p align="center">
  <strong>Ihr eigener KI-Arbeitsbereich, auf Ihren eigenen Rechnern.</strong><br />
  Chat, Agenten, Programmieren, Wissensdatenbanken und Feinabstimmung von Modellen in einer
  quelloffenen Desktop-Anwendung, für Teams und Organisationen, die ihre Dokumente und
  Unterhaltungen im eigenen Haus behalten wollen.
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a> ·
  <strong>Deutsch</strong> ·
  <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="Lizenz: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/latest"><img alt="Neueste Version" src="https://img.shields.io/github/v/release/medhiclb/HelixAI?label=release" /></a>
  <img alt="Plattformen: macOS, Windows, Linux" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" />
  <img alt="Oberfläche: Englisch, Französisch, Chinesisch, Japanisch, Spanisch, Deutsch, Arabisch" src="https://img.shields.io/badge/interface-EN%20%C2%B7%20FR%20%C2%B7%20ZH%20%C2%B7%20JA%20%C2%B7%20ES%20%C2%B7%20DE%20%C2%B7%20AR-success" />
  <a href="https://github.com/medhiclb/HelixAI/discussions"><img alt="Diskussionen" src="https://img.shields.io/badge/discussions-welcome-8a63d2" /></a>
</p>

<p align="center">
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-arm64.dmg"><img alt="Für macOS herunterladen (Apple Silicon)" src="https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-x64.dmg"><img alt="Für macOS herunterladen (Intel)" src="https://img.shields.io/badge/macOS-Intel-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-Setup-2026.1004.1-x64.exe"><img alt="Für Windows herunterladen (x64)" src="https://img.shields.io/badge/Windows-x64-0a5fb4?style=for-the-badge&logo=windows&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/helix-plateforme_2026.1004.1_amd64.deb"><img alt="Für Ubuntu und Debian herunterladen (.deb)" src="https://img.shields.io/badge/Ubuntu%20%2F%20Debian-.deb-c2410c?style=for-the-badge&logo=ubuntu&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1.AppImage"><img alt="Für Linux herunterladen (AppImage)" src="https://img.shields.io/badge/Linux-AppImage-3f3f46?style=for-the-badge&logo=linux&logoColor=white" /></a>
</p>

<p align="center">
  <a href="#installation">Installation</a>
  · <a href="#screenshots">Screenshots</a>
  · <a href="#funktionen">Funktionen</a>
  · <a href="#aus-dem-quellcode-bauen">Aus dem Quellcode bauen</a>
  · <a href="#mitwirken">Mitwirken</a>
</p>

<p align="center">
  <img src="docs/images/de/demo.gif" alt="Eine Frage in einem Chat mit dem angehängten Angebot eines Lieferanten; die Antwort kommt mit den Passagen des Firmenhandbuchs, die sie zitiert" width="900" />
</p>

<p align="center"><sub>Eine Frage zum angehängten Angebot eines Lieferanten, beantwortet aus der Wissensdatenbank des Unternehmens, mit ihren Quellen.</sub></p>

## Warum Helix AI

- **Standardmäßig lokal.** Die Modelle laufen auf Ihrem Rechner oder auf dem Server Ihrer
  Organisation, über die Engine von [LM Studio](https://lmstudio.ai), die Helix AI zusammen mit
  dem Modell installiert, das in den Arbeitsspeicher des Rechners passt. Es wird nie ein
  Cloud-Modell für Sie ausgewählt.
- **Nichts geht hinaus ohne einen Schlüssel, den Sie selbst hinterlegen.** Eine Unterhaltung
  geht nur dann an einen Cloud-Anbieter, wenn Sie dessen API-Schlüssel hinzufügen und eines
  seiner Modelle auswählen; die Modellauswahl zeigt an, wo jedes Modell läuft. Abgesehen von den
  Diensten, die Sie selbst verbinden (ein Cloud-Schlüssel, ein Postfach, Drive, Slack…), und von
  der Websuche des Chats, wenn Sie sie einschalten (Ihre Fragen gehen dann an DuckDuckGo), geht
  die Anwendung nur online, um herunterzuladen, was sie installiert (Engine, Modelle,
  Werkzeuge), und um nach neuen Versionen zu sehen (von Helix AI auf GitHub, von OpenClaw auf
  npm).
- **Open Source, nichts zu kaufen.** AGPL-3.0, kein Konto bei uns, keine Telemetrie. Jede
  Organisation installiert und betreibt ihre eigene Instanz.
- **macOS, Windows und Linux.** Eine Anwendung für die drei Systeme, auf Englisch, Französisch,
  Chinesisch, Japanisch, Spanisch, Deutsch und Arabisch.
- **Agenten, die weiterarbeiten.** Agenten mit eigenen Wissensdatenbanken und geplanten
  Missionen laufen bei geschlossenem Fenster und hinterlassen zu jedem Lauf einen Bericht;
  alles, was etwas verändert, wartet auf die Freigabe durch einen Menschen, sofern Sie es nicht
  anders festlegen.
- **Feinabstimmung aus der Anwendung.** Bringen Sie einem kleinen offenen Modell die Fakten
  Ihres Unternehmens anhand von Frage-Antwort-Beispielen bei, vergleichen Sie es mit dem
  Original und nutzen Sie es dann im Chat (MLX auf Apple Silicon).
- **Für Teams gebaut.** Konten, Gruppen, nach Gruppen geteilte Wissensdatenbanken,
  Zwei-Faktor-Authentifizierung, ein Audit-Protokoll und im Ruhezustand verschlüsselte Daten.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/images/de/chat.png" alt="Ein Chat, der aus einer Wissensdatenbank antwortet, mit einer angehängten PDF-Datei und den zitierten Quellen unter der Antwort" /></td>
    <td width="50%"><img src="docs/images/de/home.png" alt="Der Startbildschirm mit den letzten Chats und dem Modell auf dem Rechner" /></td>
  </tr>
  <tr>
    <td align="center">Chat mit einer Wissensdatenbank, einem Anhang und seinen Quellen</td>
    <td align="center">Start</td>
  </tr>
  <tr>
    <td><img src="docs/images/de/code.png" alt="Helix Code bei der Arbeit: Aufgabenliste, gelesene und bearbeitete Dateien, ein laufender Testbefehl" /></td>
    <td><img src="docs/images/de/agents.png" alt="Ein dauerhaft aktiver Agent und die Berichte seiner geplanten Missionen" /></td>
  </tr>
  <tr>
    <td align="center">Helix Code bei der Arbeit</td>
    <td align="center">Dauerhaft aktive Agenten und ihre Missionsberichte</td>
  </tr>
  <tr>
    <td><img src="docs/images/de/compare.png" alt="Modelle vergleichen: Fähigkeitswert von Epoch AI gegenüber dem Preis des Herausgebers" /></td>
    <td><img src="docs/images/de/usage.png" alt="Meine Nutzung: Anfragen, Tokens und Kosten pro Modell, lokale Modelle ohne API-Gebühren" /></td>
  </tr>
  <tr>
    <td align="center">Modelle vergleichen (Wert gegenüber Preis)</td>
    <td align="center">Meine Nutzung</td>
  </tr>
  <tr>
    <td><img src="docs/images/de/knowledge.png" alt="Eine Wissensdatenbank und ihre indexierten Dokumente" /></td>
    <td><img src="docs/images/de/training.png" alt="Ein Modell trainieren: Frage-Antwort-Beispiele" /></td>
  </tr>
  <tr>
    <td align="center">Wissensdatenbanken</td>
    <td align="center">Ein Modell trainieren</td>
  </tr>
</table>

## Installation

Laden Sie das Paket für Ihr System aus der
[Version v2026.1004.1](https://github.com/medhiclb/HelixAI/releases/tag/v2026.1004.1) herunter.
SHA-256-Prüfsummen: [`SHA256SUMS.txt`](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/SHA256SUMS.txt).

| Plattform | Download | Installation |
|---|---|---|
| **macOS** (Apple Silicon) | [Helix-2026.1004.1-arm64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-arm64.dmg) | Öffnen Sie das Disk-Image und ziehen Sie Helix in den Ordner „Programme“. Beim ersten Start: Systemeinstellungen › Datenschutz & Sicherheit › „Dennoch öffnen“ |
| **macOS** (Intel) | [Helix-2026.1004.1-x64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-x64.dmg) | Wie oben. Lokale Modelle laufen mit llama.cpp, das Helix selbst installiert. |
| **Windows 10/11** (x64) | [Helix-Setup-2026.1004.1-x64.exe](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-Setup-2026.1004.1-x64.exe) | Führen Sie das Installationsprogramm aus (keine Administratorrechte nötig). Falls SmartScreen erscheint: „Weitere Informationen“ › „Trotzdem ausführen“ |
| **Ubuntu, Debian** (x64) | [helix-plateforme_2026.1004.1_amd64.deb](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/helix-plateforme_2026.1004.1_amd64.deb) | `sudo apt install ./helix-plateforme_2026.1004.1_amd64.deb` |
| **Andere Linux-Systeme** (x64) | [Helix-2026.1004.1.AppImage](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1.AppImage) | `chmod +x Helix-2026.1004.1.AppImage`, dann ausführen. Unter Ubuntu 24.04 besser das `.deb` verwenden |

**macOS, mit einem Befehl** (empfohlen): Die Anwendung wird ohne die Gatekeeper-Abfrage
installiert, nachdem das Disk-Image gegen `SHA256SUMS.txt` und seine Codesignatur geprüft wurde:

```bash
curl -fsSL https://raw.githubusercontent.com/medhiclb/HelixAI/main/scripts/installer-macos.sh | sh
```

Beim ersten Start richtet Helix AI ein, was es braucht: die Engine von LM Studio ohne
Oberfläche (festgelegte Version, geprüfte Prüfsumme) oder die LM-Studio-Anwendung, falls sie
auf dem Rechner bereits verwendet wird, und das Modell, das am besten zum Rechner passt.
Empfohlen werden 16 GB Arbeitsspeicher; auf kleineren Rechnern wird ein leichteres Modell
gewählt. Python, Node und, für Helix Code, [OpenCode](https://github.com/anomalyco/opencode)
werden mit einem Klick installiert, wenn sie fehlen (festgelegte Versionen, geprüfte
Prüfsummen); das Chat-Modell stammt aus dem Katalog von LM Studio, in der Version, die
LM Studio ausliefert.

Neue Versionen werden in der Anwendung angekündigt: ein Klick unter macOS; unter Windows und
Linux wird das neue Paket angeboten und über das vorherige installiert, Ihre Daten bleiben
erhalten. Solange die Anwendung nicht notarisiert ist, fragt macOS nach jeder neuen Version
einmal, ob Helix auf seinen Schlüsselbundeintrag („Helix Safe Storage“) zugreifen darf: Wählen
Sie „Immer erlauben“. Unter Windows 11 blockiert Smart App Control, wenn es aktiv ist,
unsignierte Anwendungen und bietet nicht an, sie trotzdem auszuführen.

Unter Windows laufen die Befehle eines
dauerhaft aktiven Agenten auf der Stufe „Frei“ über PowerShell.

## Funktionen

- **Chat** mit lokalen Modellen, **ausgewählt für jeden Rechner**: Helix AI installiert das am
  besten bewertete offene Modell (Apache 2.0 oder MIT), das in dessen Arbeitsspeicher passt, vom
  kleinen Laptop bis zur Workstation, und schlägt die anderen vor, die der Rechner ausführen kann. Der
  Katalog umfasst Qwen, Mistral (Magistral, Ministral), OpenAI gpt-oss, Z.ai GLM, IBM Granite,
  Ai2 OLMo, Meta und DeepSeek. Cloud-Modelle funktionieren mit Ihrem eigenen API-Schlüssel.
  Anhänge, Diktat (Whisper, auf dem Rechner), Bilderzeugung (Z-Image Turbo, FLUX.2 klein) und
  kurze Videos (Wan 2.1 und 2.2), ebenfalls auf dem Rechner. Eine Nachricht, die gesendet wird,
  während noch eine Antwort geschrieben wird, wartet, bis sie an der Reihe ist, statt die
  Antwort abzubrechen.
- **Modelle vergleichen**: jedes Modell, das Sie nutzen können, eingeordnet nach Fähigkeitswert
  gegenüber dem Preis, den sein Herausgeber verlangt, sodass sich ein lokales Modell und ein
  Cloud-Modell in einem Diagramm abwägen lassen.
- **Websuche im Chat**: Schalten Sie sie im Menü « + » ein, und sie bleibt als Chip stehen, bis
  Sie sie entfernen. Die Fragen gehen an DuckDuckGo, Ihre Instanz öffnet die gefundenen Seiten,
  und die Antwort führt ihre Quellen als Links auf. Seiten werden als Daten gelesen, nie als
  Anweisungen; ein Administrator kann die Suche für die gesamte Instanz abschalten.
- **Wissensdatenbanken (RAG)**: Sammeln Sie Dokumente, die Instanz indexiert sie auf dem
  Rechner, und die Antworten zitieren die Passagen, die sie verwenden. Jede Person findet nur
  die Dokumente, die sie sehen darf.
- **Cowork**: ein Agent, der an Ihren Dateien arbeitet und, mit Ihrer Freigabe, auf einem
  virtuellen Desktop (LibreOffice, Browser), um Word-, Excel-, PowerPoint- und PDF-Dokumente zu
  erstellen.
- **Helix Code**: ein Code-Agent für Ihren Projektordner (auf OpenCode aufgebaut), mit einer
  Live-Ansicht seiner Aufgaben, Befehle und bearbeiteten Dateien; auch in **VS Code** (die
  Erweiterung liegt jeder
  [Version](https://github.com/medhiclb/HelixAI/releases/latest) bei; installieren Sie sie mit „Install from VSIX…“) und im
  Terminal mit der **Befehlszeile `helix`**. Unter macOS und Linux läuft mit einem Cloud-Modell
  die Ausgabe seiner Befehle zuerst durch [RTK](https://github.com/rtk-ai/rtk), um weniger
  Tokens zu verbrauchen; die Freigabekarte zeigt den Befehl weiterhin so, wie er geschrieben
  wurde.
- **Konnektoren**: E-Mail, Google Calendar (Lesen und Schreiben), Google Drive, Slack, Notion
  und MCP-Server, hinter einer **Freigabeschranke**: Nichts, was etwas verändert, geschieht ohne
  Ihre Zustimmung. LinkedIn verbindet ein Profil und, über eine zweite LinkedIn-App, eine
  Unternehmensseite; Palmier Pro, ein Videoeditor für Macs mit Apple Silicon, lässt Agenten auf
  seiner Timeline schneiden, solange er auf dem Mac der Instanz geöffnet ist.
- **Geplante Aufgaben**: eine Anweisung und ein Rhythmus (jeden Tag, Montag bis Freitag, ein
  Wochentag oder ein Tag im Monat), ausgeführt mit Ihren Werkzeugen, auch bei geschlossenem
  Fenster, von dem Agenten, den Sie wählen.
- **Dauerhaft aktive Agenten**: geplante Missionen, Antworten auf eingehende E-Mails und auf
  Messaging-Apps, mit eigenen Wissensdatenbanken und eigenem Foto. Eine empfangene E-Mail wird
  mit eingeschränkten Rechten bearbeitet: Im Web öffnet der Agent nur Adressen, die er bereits
  gesehen hat.
- **Ein Modell trainieren**: Beispiele, Training, Vergleich mit dem Original, dann Installation
  in LM Studio (MLX auf Apple Silicon, Unsloth auf NVIDIA-Karten).
- **Meine Nutzung**: Anfragen und Tokens pro Modell, aus den Antworten jeder Engine gelesen;
  lokale Modelle kosten keine API-Gebühren, Cloud-Modelle werden nach Ihrem Tarif oder nach dem
  veröffentlichten Preis des Anbieters berechnet, mit Datum.
- **Entwickler-API**: persönliche API-Schlüssel für die OpenAI-kompatible API der Instanz
  (`/v1/models`, `/v1/chat/completions`, Wissensdatenbanken inbegriffen), in Ihrem Namen und
  nicht mehr, sofort widerrufbar.
- **Besprechungen**: aufnehmen oder importieren, Transkription und Protokoll auf dem Rechner,
  Besprechungs-Bot.
- **Importieren** Sie Ihren Verlauf aus ChatGPT, Claude, Gemini (Google Takeout), Claude Code, Codex und Cursor.
- **Teams**: Konten, Gruppen, Teilen, Zwei-Faktor-Authentifizierung, Audit-Protokoll,
  DSGVO-Export, im Ruhezustand verschlüsselte Daten.
- **White Label**: Produktname, Logo und Farben stammen aus einer einzigen Konfigurationsdatei.

## Aus dem Quellcode bauen

Voraussetzungen: macOS (Apple Silicon oder Intel), Windows 10/11 oder Linux (x64), Node.js 22.18
oder neuer und npm. Node wird nur zum Bauen und Entwickeln gebraucht: Das Gateway führt sein
TypeScript direkt aus, und die installierte Anwendung braucht weder Node noch Python.

```bash
git clone https://github.com/medhiclb/HelixAI
cd HelixAI
npm install
npm run app
```

`npm run app` baut das Gateway und öffnet die Desktop-Anwendung, die ihr eigenes lokales Gateway
startet. Die Weboberfläche allein läuft mit `npm run gateway` und `npm run dev` in zwei
Terminals.

```bash
npm run package      # macOS: .dmg und .zip in release/
npx electron-builder --win nsis --x64            # Windows-Installationsprogramm (nach npm run build)
npx electron-builder --linux AppImage deb --x64  # Linux-Pakete (nach npm run build)
npm run typecheck    # Oberfläche und Gateway
npm run securite     # Sicherheitsprüfungen gegen eine Wegwerf-Instanz
```

Signierung und Notarisierung sind vorbereitet und warten nur auf ein Apple-Zertifikat: siehe
[SIGNATURE.md](SIGNATURE.md).

### Befehlszeile

Die Desktop-Anwendung liefert den Befehl `helix` mit. Richten Sie ihn unter
**Einstellungen › Apps installieren › CLI** ein (unter Windows öffnen Sie danach ein neues PowerShell- oder Eingabeaufforderungsfenster), dann:

```bash
helix connexion          # einmal mit dem Konto Ihrer Instanz anmelden
helix chat               # ein Chat im Terminal
helix chat --outils      # mit Ihren Konnektoren, hinter der Freigabeschranke
helix code               # der Code-Agent im aktuellen Ordner
```

### Dokumentation

Die technische Dokumentation ist auf Französisch verfasst: [docs/GUIDE.md](docs/GUIDE.md)
(Gateway, Routen, Konnektoren, Bereitstellung, Umbenennung der Marke),
[ARCHITECTURE.md](ARCHITECTURE.md), [SECURITE.md](SECURITE.md), [SCREENS.md](SCREENS.md) (jeder
Bildschirm und was er wirklich tut) und [PROJET.md](PROJET.md) (Absichten, Entscheidungen,
aktueller Stand).

## Mitwirken

Beiträge sind willkommen, vom Tippfehler bis zum neuen Konnektor.

- Lesen Sie [CONTRIBUTING.md](CONTRIBUTING.md) und unterzeichnen Sie das [CLA](CLA.md) vor
  Ihrem ersten Pull Request.
- Fragen und Ideen: [Discussions](https://github.com/medhiclb/HelixAI/discussions).
- Fehler und Funktionswünsche: [Issues](https://github.com/medhiclb/HelixAI/issues) oder aus
  der Anwendung heraus: Einstellungen › Problem melden; dort wird ein Issue oder eine E-Mail
  vorbereitet, die Sie selbst prüfen und absenden.
- Sicherheitslücken: Melden Sie sie vertraulich, siehe [SECURITY.md](SECURITY.md).
- [Verhaltenskodex](CODE_OF_CONDUCT.md).

## Lizenz

[GNU AGPL-3.0](LICENSE). Sie dürfen Helix AI nutzen, verändern, weiterverbreiten und verkaufen.
Wer es verbreitet oder als Online-Dienst anbietet, muss den Code seiner Version unter derselben
Lizenz veröffentlichen. Einzelheiten in [COPYRIGHT.md](COPYRIGHT.md).

LM Studio, die standardmäßige Modell-Engine, ist eine Closed-Source-Software, deren Bedingungen
die persönliche Nutzung und die interne Nutzung in einer Organisation erlauben, nicht aber einen
Dienst für Dritte: Lesen Sie [PROJET.md § 3.9](PROJET.md), bevor Sie eine Instanz für andere
hosten.

## Danksagungen

Die Modellwerte in „Modelle vergleichen“ stammen von **Epoch AI**,
[Capabilities & benchmarking](https://epoch.ai/benchmarks/use-this-data) (Epoch Capabilities
Index), lizenziert unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), abgerufen am
27. September 2026. Die Preise stammen von den Preisseiten der Herausgeber selbst, am selben Tag
erfasst.

Gebaut mit Open-Source-Arbeit, unter anderem:
[OpenCode](https://github.com/anomalyco/opencode),
[RTK](https://github.com/rtk-ai/rtk),
[OpenClaw](https://github.com/openclaw/openclaw),
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp),
[MLX](https://github.com/ml-explore/mlx),
[Unsloth](https://github.com/unslothai/unsloth),
[Whisper](https://github.com/openai/whisper),
[Qwen](https://github.com/QwenLM),
[LangChain.js](https://github.com/langchain-ai/langchainjs) (Textaufteilung),
[AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) (Gestaltung der Wissensdatenbanken),
[UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
[Lume](https://github.com/trycua/cua), [Electron](https://www.electronjs.org),
[React](https://react.dev) und [Vite](https://vite.dev).
