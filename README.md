<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.png" />
    <img src="docs/images/logo-light.png" alt="Helix AI logo" height="120" />
  </picture>
</p>

<h1 align="center">Helix AI</h1>

<p align="center">
  <strong>Your own AI workspace, on your own machines.</strong><br />
  Chat, agents, coding, knowledge bases and fine-tuning in one open-source desktop app,
  for teams and organisations that want to keep their documents and conversations at home.
</p>

<p align="center">
  <strong>English</strong> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/medhiclb/HelixAI?label=release" /></a>
  <img alt="Platforms: macOS, Windows, Linux" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" />
  <img alt="Interface: English, French, Chinese, Japanese, Spanish, German, Arabic" src="https://img.shields.io/badge/interface-EN%20%C2%B7%20FR%20%C2%B7%20ZH%20%C2%B7%20JA%20%C2%B7%20ES%20%C2%B7%20DE%20%C2%B7%20AR-success" />
  <a href="https://github.com/medhiclb/HelixAI/discussions"><img alt="Discussions" src="https://img.shields.io/badge/discussions-welcome-8a63d2" /></a>
</p>

<p align="center">
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-arm64.dmg"><img alt="Download for macOS (Apple Silicon)" src="https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-x64.dmg"><img alt="Download for macOS (Intel)" src="https://img.shields.io/badge/macOS-Intel-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-Setup-2026.1004.2-x64.exe"><img alt="Download for Windows (x64)" src="https://img.shields.io/badge/Windows-x64-0a5fb4?style=for-the-badge&logo=windows&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/helix-plateforme_2026.1004.2_amd64.deb"><img alt="Download for Ubuntu and Debian (.deb)" src="https://img.shields.io/badge/Ubuntu%20%2F%20Debian-.deb-c2410c?style=for-the-badge&logo=ubuntu&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2.AppImage"><img alt="Download for Linux (AppImage)" src="https://img.shields.io/badge/Linux-AppImage-3f3f46?style=for-the-badge&logo=linux&logoColor=white" /></a>
</p>

<p align="center">
  <a href="#installation">Installation</a>
  · <a href="#screenshots">Screenshots</a>
  · <a href="#features">Features</a>
  · <a href="#build-from-source">Build from source</a>
  · <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="docs/images/demo.gif" alt="A question asked in a Chat with a supplier quote attached; the answer arrives with the passages of the company handbook it cites" width="900" />
</p>

<p align="center"><sub>A question about an attached supplier quote, answered from the company's knowledge base, with its sources.</sub></p>

## Why Helix AI

- **Local by default.** Models run on your machine or on your organisation's server, through
  [LM Studio](https://lmstudio.ai)'s engine, which Helix AI installs with the model that fits
  the machine's memory. No cloud model is ever selected for you.
- **Nothing leaves without a key you plug in.** A conversation goes to a cloud provider only if
  you add that provider's API key and pick one of its models; the model picker says where each
  model runs. Apart from the services you connect yourself (a cloud key, a mailbox, Drive,
  Slack…) and the Chat's web search when you turn it on (your questions then go to DuckDuckGo),
  the app goes online only to download what it installs (engine, models, tools) and to look up
  new versions (of Helix AI on GitHub, of OpenClaw on npm).
- **Open source, nothing to buy.** AGPL-3.0, no account with us, no telemetry. Each
  organisation installs and runs its own instance.
- **macOS, Windows and Linux.** One app for the three systems, in English, French, Chinese,
  Japanese, Spanish, German and Arabic.
- **Agents that keep working.** Agents with their own knowledge bases and scheduled missions
  run while the window is closed and leave a report of each run; anything that changes
  something waits for a person's approval, unless you decide otherwise.
- **Fine-tuning from the app.** Teach a small open model your company's facts from question and
  answer examples, compare it with the original, then use it in the Chat (MLX on Apple Silicon).
- **Built for teams.** Accounts, groups, knowledge bases shared by group, two-factor
  authentication, an audit log and data encrypted at rest.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/images/chat.png" alt="A Chat answering from a knowledge base, with an attached PDF and the cited sources under the answer" /></td>
    <td width="50%"><img src="docs/images/home.png" alt="The home screen, with the recent Chats and the model on the machine" /></td>
  </tr>
  <tr>
    <td align="center">Chat with a knowledge base, an attachment and its sources</td>
    <td align="center">Home</td>
  </tr>
  <tr>
    <td><img src="docs/images/code.png" alt="Helix Code at work: task list, file reads and edits, a test command running" /></td>
    <td><img src="docs/images/agents.png" alt="An always-on agent and the reports of its scheduled missions" /></td>
  </tr>
  <tr>
    <td align="center">Helix Code at work</td>
    <td align="center">Always-on agents and their mission reports</td>
  </tr>
  <tr>
    <td><img src="docs/images/compare.png" alt="Compare the models: Epoch AI capability score against the publisher's price" /></td>
    <td><img src="docs/images/usage.png" alt="My usage: requests, tokens and cost per model, local models free of API charges" /></td>
  </tr>
  <tr>
    <td align="center">Compare the models (score against price)</td>
    <td align="center">My usage</td>
  </tr>
  <tr>
    <td><img src="docs/images/knowledge.png" alt="A knowledge base and its indexed documents" /></td>
    <td><img src="docs/images/training.png" alt="Train a model: question and answer examples" /></td>
  </tr>
  <tr>
    <td align="center">Knowledge bases</td>
    <td align="center">Train a model</td>
  </tr>
</table>

## Installation

Download the package for your system from the
[v2026.1004.2 release](https://github.com/medhiclb/HelixAI/releases/tag/v2026.1004.2).
SHA-256 checksums: [`SHA256SUMS.txt`](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/SHA256SUMS.txt).

| Platform | Download | Installation |
|---|---|---|
| **macOS** (Apple Silicon) | [Helix-2026.1004.2-arm64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-arm64.dmg) | Open the disk image and drag Helix to Applications. On first launch: System Settings › Privacy & Security › "Open Anyway" |
| **macOS** (Intel) | [Helix-2026.1004.2-x64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-x64.dmg) | Same as above. Local models run on llama.cpp, which Helix installs itself. |
| **Windows 10/11** (x64) | [Helix-Setup-2026.1004.2-x64.exe](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-Setup-2026.1004.2-x64.exe) | Run the installer (no administrator rights needed). If SmartScreen appears: "More info" › "Run anyway" |
| **Ubuntu, Debian** (x64) | [helix-plateforme_2026.1004.2_amd64.deb](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/helix-plateforme_2026.1004.2_amd64.deb) | `sudo apt install ./helix-plateforme_2026.1004.2_amd64.deb` |
| **Other Linux** (x64) | [Helix-2026.1004.2.AppImage](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2.AppImage) | `chmod +x Helix-2026.1004.2.AppImage`, then run it. On Ubuntu 24.04, prefer the `.deb` |

**macOS, in one command** (recommended): the app installs without the Gatekeeper prompt, after
checking the disk image against `SHA256SUMS.txt` and its code signature:

```bash
curl -fsSL https://raw.githubusercontent.com/medhiclb/HelixAI/main/scripts/installer-macos.sh | sh
```

On first launch, Helix AI sets up what it needs: LM Studio's headless engine (pinned version,
verified checksum), or the LM Studio app if it is already in use on the machine, and the model
best suited to the machine. 16 GB of memory is recommended; on smaller machines a lighter model
is picked. Python, Node and, for Helix Code, [OpenCode](https://github.com/anomalyco/opencode)
are installed in one click when missing (pinned versions, verified checksums); the chat model
comes from LM Studio's catalogue, at the version LM Studio serves.

New versions are announced in the app: one click on macOS; on Windows and Linux, the new package
is offered and installs over the previous one, and your data is kept. Until the app is notarised,
macOS asks once after each new version for Helix to access its keychain item ("Helix Safe
Storage"): choose "Always Allow". On Windows 11, Smart App Control, when active, blocks unsigned
apps and does not offer to run them anyway.

On Windows, the commands of an always-on agent
at the "Free" level go through PowerShell.

## Features

- **Chat** with local models **picked for each machine**: Helix AI installs the best-rated open
  model (Apache 2.0 or MIT) that fits its memory, from a small laptop to a workstation, and
  suggests the others it can run. The catalogue covers Qwen, Mistral (Magistral, Ministral),
  OpenAI gpt-oss, Z.ai GLM, IBM Granite, Ai2 OLMo, Meta and DeepSeek. Cloud models work with your
  own API key. Attachments, dictation (Whisper, on the machine), image generation (Z-Image Turbo,
  FLUX.2 klein) and short videos (Wan 2.1 and 2.2), also on the machine. A message sent while an answer is still being written waits its turn instead of cutting it.
- **Compare the models**: every model you can use, placed by capability score against the price
  its publisher charges, so a local model and a cloud one can be weighed on one chart.
- **Web search in the Chat**: turn it on from the « + » menu and it stays as a chip until you
  remove it. Questions go to DuckDuckGo, your instance opens the pages found, and the answer
  lists its sources as links. Pages are read as data, never as instructions; an administrator
  can switch it off for the whole instance.
- **Knowledge bases (RAG)**: gather documents, the instance indexes them on the machine, and
  answers cite the passages they use. Everyone only finds the documents they are allowed to see.
- **Cowork**: an agent that works on your files and, with your approval, on a virtual desktop
  (LibreOffice, browser) to produce Word, Excel, PowerPoint and PDF documents.
- **Helix Code**: a coding agent on your project folder (built on OpenCode), with a live panel of
  its tasks, commands and edited files; also in **VS Code** (the extension is attached to every
  [release](https://github.com/medhiclb/HelixAI/releases/latest); install it with "Install from VSIX…") and in the
  terminal with the **`helix` command line**. On macOS and Linux, with a cloud model, the output of its
  commands goes through [RTK](https://github.com/rtk-ai/rtk) first, to spend fewer tokens; the approval card
  still shows the command as written.
- **Connectors**: mail, Google Calendar (read and write), Google Drive, Slack, Notion and MCP
  servers, behind an **approval gate**: nothing that changes something happens without your
  go-ahead. LinkedIn connects a profile and, through a second LinkedIn app, a company Page;
  Palmier Pro, a video editor for Apple silicon Macs, lets agents edit on its timeline while it
  is open on the instance's Mac.
- **Scheduled tasks**: an instruction and a rhythm (every day, Monday to Friday, a day of the week
  or of the month), run with your tools, even with the window closed, by the agent you choose.
- **Always-on agents**: scheduled missions, replies to incoming mail and messaging apps, with
  their own knowledge bases and photo. A received email is handled with reduced rights: on the
  web, the agent only opens addresses it has already seen.
- **Train a model**: examples, training, comparison with the original, then installation in
  LM Studio (MLX on Apple Silicon, Unsloth on NVIDIA cards).
- **My usage**: requests and tokens per model, read from each engine's answers; local models cost
  no API fees, cloud ones are priced from your rate or the provider's published price, dated.
- **Developer API**: personal API keys for the instance's OpenAI-compatible API (`/v1/models`,
  `/v1/chat/completions`, knowledge bases included), in your name and nothing more, revocable at
  once.
- **Meetings**: record or import, transcription and minutes on the machine, meeting bot.
- **Import** your history from ChatGPT, Claude, Gemini (Google Takeout), Claude Code, Codex and Cursor.
- **Teams**: accounts, groups, sharing, two-factor authentication, audit log, GDPR export, data
  encrypted at rest.
- **White label**: the product name, logo and colours come from one configuration file.

## Build from source

Prerequisites: macOS (Apple Silicon or Intel), Windows 10/11 or Linux (x64), Node.js 22.18 or later and
npm. Node is only needed to build and develop: the gateway runs its TypeScript directly, and the
installed app needs neither Node nor Python.

```bash
git clone https://github.com/medhiclb/HelixAI
cd HelixAI
npm install
npm run app
```

`npm run app` builds the gateway and opens the desktop app, which starts its own local gateway.
The web interface alone runs with `npm run gateway` and `npm run dev` in two terminals.

```bash
npm run package      # macOS: .dmg and .zip in release/
npx electron-builder --win nsis --x64            # Windows installer (after npm run build)
npx electron-builder --linux AppImage deb --x64  # Linux packages (after npm run build)
npm run typecheck    # interface and gateway
npm run securite     # security checks against a throwaway instance
```

Signing and notarisation are ready and only wait for an Apple certificate: see
[SIGNATURE.md](SIGNATURE.md).

### Command line

The desktop app ships the `helix` command. Set it up from **Settings › Install the apps › CLI**
(on Windows, then open a new PowerShell or Command Prompt), then:

```bash
helix connexion          # sign in once with your instance account
helix chat               # a Chat in the terminal
helix chat --outils      # with your connectors, behind the approval gate
helix code               # the coding agent on the current folder
```

### Documentation

The technical documentation is written in French: [docs/GUIDE.md](docs/GUIDE.md) (gateway,
routes, connectors, deployment, rebranding), [ARCHITECTURE.md](ARCHITECTURE.md),
[SECURITE.md](SECURITE.md), [SCREENS.md](SCREENS.md) (every screen and what it really does) and
[PROJET.md](PROJET.md) (intentions, decisions, current state).

## Contributing

Contributions are welcome, from a typo to a new connector.

- Read [CONTRIBUTING.md](CONTRIBUTING.md), and sign the [CLA](CLA.md) before your first pull
  request.
- Questions and ideas: [Discussions](https://github.com/medhiclb/HelixAI/discussions).
- Bugs and feature requests: [Issues](https://github.com/medhiclb/HelixAI/issues), or from the
  app: Settings › Report a problem, which prepares an issue or an email that you review and send
  yourself.
- Security vulnerabilities: report them privately, see [SECURITY.md](SECURITY.md).
- [Code of conduct](CODE_OF_CONDUCT.md).

## License

[GNU AGPL-3.0](LICENSE). You may use, modify, redistribute and sell Helix AI. Whoever
distributes it, or offers it as an online service, must publish the code of their version under
the same licence. Details in [COPYRIGHT.md](COPYRIGHT.md).

LM Studio, the default model engine, is closed-source software whose terms allow personal use
and an organisation's internal use, not a service provided to others: read
[PROJET.md § 3.9](PROJET.md) before hosting an instance for others.

## Acknowledgements

Model scores in "Compare the models" come from **Epoch AI**,
[Capabilities & benchmarking](https://epoch.ai/benchmarks/use-this-data) (Epoch Capabilities
Index), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), retrieved on
27 September 2026. Prices come from the publishers' own pricing pages, recorded the same day.

Built with open-source work, among others:
[OpenCode](https://github.com/anomalyco/opencode),
[RTK](https://github.com/rtk-ai/rtk),
[OpenClaw](https://github.com/openclaw/openclaw),
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp),
[MLX](https://github.com/ml-explore/mlx),
[Unsloth](https://github.com/unslothai/unsloth),
[Whisper](https://github.com/openai/whisper),
[Qwen](https://github.com/QwenLM),
[LangChain.js](https://github.com/langchain-ai/langchainjs) (text splitter),
[AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) (design of the knowledge bases),
[UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
[Lume](https://github.com/trycua/cua), [Electron](https://www.electronjs.org),
[React](https://react.dev) and [Vite](https://vite.dev).
