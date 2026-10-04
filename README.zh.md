<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.png" />
    <img src="docs/images/logo-light.png" alt="Helix AI 标志" height="120" />
  </picture>
</p>

<h1 align="center">Helix AI</h1>

<p align="center">
  <strong>属于您自己的 AI 工作空间，运行在您自己的机器上。</strong><br />
  Chat、智能体、编程、知识库和模型微调，集成在一个开源桌面应用中，
  面向希望把文档和对话留在自己手中的团队和组织。
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.fr.md">Français</a> ·
  <strong>中文</strong> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="许可证：AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/latest"><img alt="最新版本" src="https://img.shields.io/github/v/release/medhiclb/HelixAI?label=release" /></a>
  <img alt="平台：macOS、Windows、Linux" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" />
  <img alt="界面：英语、法语、中文、日语、西班牙语、德语、阿拉伯语" src="https://img.shields.io/badge/interface-EN%20%C2%B7%20FR%20%C2%B7%20ZH%20%C2%B7%20JA%20%C2%B7%20ES%20%C2%B7%20DE%20%C2%B7%20AR-success" />
  <a href="https://github.com/medhiclb/HelixAI/discussions"><img alt="讨论区" src="https://img.shields.io/badge/discussions-welcome-8a63d2" /></a>
</p>

<p align="center">
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-arm64.dmg"><img alt="下载 macOS 版（Apple 芯片）" src="https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-x64.dmg"><img alt="下载 macOS 版（Intel）" src="https://img.shields.io/badge/macOS-Intel-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-Setup-2026.1004.2-x64.exe"><img alt="下载 Windows 版（x64）" src="https://img.shields.io/badge/Windows-x64-0a5fb4?style=for-the-badge&logo=windows&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/helix-plateforme_2026.1004.2_amd64.deb"><img alt="下载 Ubuntu 和 Debian 版（.deb）" src="https://img.shields.io/badge/Ubuntu%20%2F%20Debian-.deb-c2410c?style=for-the-badge&logo=ubuntu&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2.AppImage"><img alt="下载 Linux 版（AppImage）" src="https://img.shields.io/badge/Linux-AppImage-3f3f46?style=for-the-badge&logo=linux&logoColor=white" /></a>
</p>

<p align="center">
  <a href="#安装">安装</a>
  · <a href="#截图">截图</a>
  · <a href="#功能">功能</a>
  · <a href="#从源码构建">从源码构建</a>
  · <a href="#参与贡献">参与贡献</a>
</p>

<p align="center">
  <img src="docs/images/zh/demo.gif" alt="在 Chat 中附上一份供应商报价并提问；回答随即给出，并引用公司手册中的相关段落" width="900" />
</p>

<p align="center"><sub>针对附件中的供应商报价提问，回答依据公司知识库给出，并注明来源。</sub></p>

## 为什么选择 Helix AI

- **默认在本地运行。** 模型通过 [LM Studio](https://lmstudio.ai) 的引擎在您的电脑或组织的服务器上运行，Helix AI 会一并安装与机器内存相匹配的模型。系统绝不会替您选择云端模型。
- **不接入密钥，就不会外传。** 只有当您添加某个云端服务商的 API 密钥并选择其模型时，对话才会发送给该服务商；模型选择器会标明每个模型的运行位置。除您自行连接的服务（云端密钥、邮箱、Drive、Slack 等）以及您开启的 Chat 网络搜索（问题会发送到 DuckDuckGo）之外，应用联网只为下载它要安装的内容（引擎、模型、工具）以及查询新版本（在 GitHub 上查询 Helix AI，在 npm 上查询 OpenClaw）。
- **开源，无需购买。** AGPL-3.0，无需在我们这里注册账户，无遥测。每个组织自行安装并运行自己的实例。
- **macOS、Windows 和 Linux。** 三个系统使用同一个应用，界面提供英语、法语、中文、日语、西班牙语、德语和阿拉伯语。
- **持续工作的智能体。** 智能体拥有各自的知识库和定时任务，窗口关闭后照常运行，每次运行都会留下报告；任何会修改内容的操作都要等待人工批准，除非您另作决定。
- **在应用中微调模型。** 用问答示例让小型开源模型学习贵公司的信息，与原始模型对比，然后在 Chat 中使用（Apple 芯片上使用 MLX）。
- **为团队设计。** 账户、群组、按群组共享的知识库、双重认证、审计日志，数据落盘加密。

## 截图

<table>
  <tr>
    <td width="50%"><img src="docs/images/zh/chat.png" alt="基于知识库回答的 Chat，附有一个文件，回答下方注明来源" /></td>
    <td width="50%"><img src="docs/images/zh/home.png" alt="首页，显示最近的对话和本机模型" /></td>
  </tr>
  <tr>
    <td align="center">带知识库、附件和来源的 Chat</td>
    <td align="center">首页</td>
  </tr>
  <tr>
    <td><img src="docs/images/zh/code.png" alt="工作中的 Helix Code：任务列表、读取和修改的文件、正在运行的测试命令" /></td>
    <td><img src="docs/images/zh/agents.png" alt="一个全天候智能体及其定时任务的报告" /></td>
  </tr>
  <tr>
    <td align="center">工作中的 Helix Code</td>
    <td align="center">全天候智能体及其任务报告</td>
  </tr>
  <tr>
    <td><img src="docs/images/zh/compare.png" alt="模型比较：Epoch AI 能力评分与发布方价格对照" /></td>
    <td><img src="docs/images/zh/usage.png" alt="我的用量：按模型统计的请求、令牌和费用，本地模型没有 API 费用" /></td>
  </tr>
  <tr>
    <td align="center">模型比较（评分与价格）</td>
    <td align="center">我的用量</td>
  </tr>
  <tr>
    <td><img src="docs/images/zh/knowledge.png" alt="一个知识库及其已建立索引的文档" /></td>
    <td><img src="docs/images/zh/training.png" alt="训练模型：问答示例" /></td>
  </tr>
  <tr>
    <td align="center">知识库</td>
    <td align="center">训练模型</td>
  </tr>
</table>

## 安装

请在 [v2026.1004.2 发布页](https://github.com/medhiclb/HelixAI/releases/tag/v2026.1004.2)下载适合您系统的安装包。SHA-256 校验值：[`SHA256SUMS.txt`](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/SHA256SUMS.txt)。

| 系统 | 下载 | 安装方法 |
|---|---|---|
| **macOS**（Apple 芯片） | [Helix-2026.1004.2-arm64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-arm64.dmg) | 打开磁盘映像，将 Helix 拖入“应用程序”。首次启动时：系统设置 › 隐私与安全性 › “仍要打开” |
| **macOS**（Intel） | [Helix-2026.1004.2-x64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-x64.dmg) | 同上。本地模型由 Helix 自行安装的 llama.cpp 运行。 |
| **Windows 10/11**（x64） | [Helix-Setup-2026.1004.2-x64.exe](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-Setup-2026.1004.2-x64.exe) | 运行安装程序（无需管理员权限）。如出现 SmartScreen：“更多信息” › “仍要运行” |
| **Ubuntu、Debian**（x64） | [helix-plateforme_2026.1004.2_amd64.deb](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/helix-plateforme_2026.1004.2_amd64.deb) | `sudo apt install ./helix-plateforme_2026.1004.2_amd64.deb` |
| **其他 Linux**（x64） | [Helix-2026.1004.2.AppImage](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2.AppImage) | `chmod +x Helix-2026.1004.2.AppImage`，然后运行。在 Ubuntu 24.04 上建议使用 `.deb` |

**macOS 一条命令安装**（推荐）：先根据 `SHA256SUMS.txt` 校验磁盘映像及其代码签名，再安装应用，不会出现 Gatekeeper 提示：

```bash
curl -fsSL https://raw.githubusercontent.com/medhiclb/HelixAI/main/scripts/installer-macos.sh | sh
```

首次启动时，Helix AI 会安装所需的一切：LM Studio 的无界面引擎（版本固定，校验值已验证；若本机已在使用 LM Studio 应用，则直接使用该应用）以及最适合本机的模型。建议内存为 16 GB；内存较小的机器会选用更轻量的模型。若缺少 Python、Node 以及 Helix Code 所需的 [OpenCode](https://github.com/anomalyco/opencode)，可一键安装（版本固定，校验值已验证）；对话模型来自 LM Studio 的目录，版本由 LM Studio 提供。

新版本会在应用内提示：macOS 上一键安装；在 Windows 和 Linux 上，会提供新安装包，覆盖旧版本安装即可，数据会保留。在应用获得公证之前，每次安装新版本后，macOS 会询问一次是否允许 Helix 访问其钥匙串项目（“Helix Safe Storage”）：请选择“始终允许”。在 Windows 11 上，智能应用控制（Smart App Control）启用时会阻止未签名的应用，且不提供“仍要运行”选项。

在 Windows 上，“自由”级别的全天候智能体的命令通过 PowerShell 执行。

## 功能

- **Chat**：使用**按每台机器挑选**的本地模型：Helix AI 会安装能装入该机器内存、评分最高的开源模型（Apache 2.0 或 MIT），从小型笔记本到工作站都适用，并推荐该机器能运行的其他模型。模型目录涵盖 Qwen、Mistral（Magistral、Ministral）、OpenAI gpt-oss、Z.ai GLM、IBM Granite、Ai2 OLMo、Meta 和 DeepSeek。云端模型可用您自己的 API 密钥。支持附件、语音输入（Whisper，本机运行）、图像生成（Z-Image Turbo、FLUX.2 klein）以及短视频生成（Wan 2.1 和 2.2），同样在本机运行。在回答生成过程中发送的消息会排队等候，而不会打断当前回答。
- **模型比较**：您可以使用的每个模型都按能力评分与其发布方的价格排布，本地模型和云端模型可以在同一张图上权衡。
- **Chat 中的网络搜索**：从「+」菜单开启后，它会以标签形式保留，直到您移除。问题发送到 DuckDuckGo，您的实例打开找到的网页，回答以链接列出其来源。网页只作为数据读取，绝不作为指令；管理员可以为整个实例关闭此功能。
- **知识库（RAG）**：汇集文档，实例在本机为其建立索引，回答会引用所用的段落。每个人只能找到自己有权查看的文档。
- **Cowork**：在您的文件上工作的智能体，经您同意后还可在虚拟桌面（LibreOffice、浏览器）上操作，生成 Word、Excel、PowerPoint 和 PDF 文档。
- **Helix Code**：作用于项目文件夹的代码智能体（基于 OpenCode），配有实时面板，显示其任务、命令和修改的文件；也可在 **VS Code**（扩展随每个[版本](https://github.com/medhiclb/HelixAI/releases/latest)附带，通过“Install from VSIX…”安装）和终端中通过 **`helix` 命令行**使用。在 macOS 和 Linux 上使用云端模型时，其命令的输出会先经过 [RTK](https://github.com/rtk-ai/rtk) 精简，以减少 token 消耗；审批卡片仍显示原始命令。
- **连接器**：邮件、Google 日历（读写）、Google Drive、Slack、Notion 和 MCP 服务器，均受**审批机制**保护：任何修改操作都须经您同意。LinkedIn 可连接个人资料，并通过第二个 LinkedIn 应用连接公司主页；Palmier Pro（适用于 Apple 芯片 Mac 的视频剪辑软件）在实例所在的 Mac 上打开时，智能体可在其时间线上剪辑。
- **定时任务**：一条指令加一个频率（每天、周一至周五、每周或每月某天），用您的工具执行，即使窗口关闭也会运行，可指定执行的智能体。
- **全天候智能体**：定时任务、回复收到的邮件和即时消息，并可使用各自的知识库和头像。处理收到的邮件时权限受限：上网时只打开已见过的地址。
- **训练模型**：示例、训练、与原始模型对比，然后安装到 LM Studio（Apple 芯片上使用 MLX，NVIDIA 显卡上使用 Unsloth）。
- **我的用量**：按模型统计的请求和令牌，读取自每个引擎的响应；本地模型没有 API 费用，云端模型按您填写的费率或服务商公布的价格计费，并注明日期。
- **开发者 API**：个人 API 密钥，用于实例的 OpenAI 兼容 API（`/v1/models`、`/v1/chat/completions`，含知识库），以您的名义使用且仅限于此，可随时撤销。
- **会议**：录制或导入，在本机转写并生成纪要，支持会议机器人。
- **导入**来自 ChatGPT、Claude、Gemini（Google Takeout）、Claude Code、Codex 和 Cursor 的历史记录。
- **团队**：账户、群组、共享、双重认证、审计日志、GDPR 导出，数据落盘加密。
- **白标**：产品名称、标志和颜色都来自同一个配置文件。

## 从源码构建

前提条件：macOS（Apple 芯片或 Intel）、Windows 10/11 或 Linux（x64），Node.js 22.18 或更高版本以及 npm。Node 仅用于构建和开发：网关直接运行其 TypeScript，安装后的应用既不需要 Node，也不需要 Python。

```bash
git clone https://github.com/medhiclb/HelixAI
cd HelixAI
npm install
npm run app
```

`npm run app` 会构建网关并打开桌面应用，由应用启动自己的本地网关。若只运行 Web 界面，请在两个终端中分别执行 `npm run gateway` 和 `npm run dev`。

```bash
npm run package      # macOS：在 release/ 中生成 .dmg 和 .zip
npx electron-builder --win nsis --x64            # Windows 安装程序（先执行 npm run build）
npx electron-builder --linux AppImage deb --x64  # Linux 安装包（先执行 npm run build）
npm run typecheck    # 界面和网关
npm run securite     # 针对一次性实例的安全检查
```

签名和公证已准备就绪，只待 Apple 证书：参见 [SIGNATURE.md](SIGNATURE.md)。

### 命令行

桌面应用附带 `helix` 命令。在 **设置 › 安装应用 › CLI** 中完成设置（在 Windows 上，随后打开新的 PowerShell 或命令提示符），然后：

```bash
helix connexion          # 使用实例账户登录一次
helix chat               # 在终端中使用 Chat
helix chat --outils      # 使用您的连接器，受审批机制保护
helix code               # 在当前文件夹上运行代码智能体
```

### 文档

技术文档以法语撰写：[docs/GUIDE.md](docs/GUIDE.md)（网关、路由、连接器、部署、更换品牌）、[ARCHITECTURE.md](ARCHITECTURE.md)、[SECURITE.md](SECURITE.md)、[SCREENS.md](SCREENS.md)（每个界面及其实际功能）和 [PROJET.md](PROJET.md)（意图、决策、现状）。

## 参与贡献

欢迎任何贡献，从修正错别字到新的连接器。

- 请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，并在首次提交 pull request 前签署 [CLA](CLA.md)。
- 问题和想法：[Discussions](https://github.com/medhiclb/HelixAI/discussions)。
- 缺陷和功能请求：[Issues](https://github.com/medhiclb/HelixAI/issues)，或在应用中：设置 › 报告问题，会生成一个预填好的 issue 或邮件，由您检查后自行发送。
- 安全漏洞：请私下报告，参见 [SECURITY.md](SECURITY.md)。
- [行为准则](CODE_OF_CONDUCT.md)。

## 许可证

[GNU AGPL-3.0](LICENSE)。您可以使用、修改、再分发和出售 Helix AI。任何分发它或将其作为在线服务提供的人，都必须以相同许可证公开其版本的代码。详情见 [COPYRIGHT.md](COPYRIGHT.md)。

默认模型引擎 LM Studio 是闭源软件，其条款允许个人使用和组织内部使用，但不允许向他人提供服务：在为他人托管实例之前，请阅读 [PROJET.md § 3.9](PROJET.md)。

## 致谢

“模型比较”中的模型评分来自 **Epoch AI** 的 [Capabilities & benchmarking](https://epoch.ai/benchmarks/use-this-data)（Epoch Capabilities Index，ECI 指数），采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可，获取于 2026 年 9 月 27 日。价格来自各发布方的官方价格页面，记录于同一天。

本项目基于众多开源成果构建，其中包括：
[OpenCode](https://github.com/anomalyco/opencode)、
[RTK](https://github.com/rtk-ai/rtk)、
[OpenClaw](https://github.com/openclaw/openclaw)、
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)、
[MLX](https://github.com/ml-explore/mlx)、
[Unsloth](https://github.com/unslothai/unsloth)、
[Whisper](https://github.com/openai/whisper)、
[Qwen](https://github.com/QwenLM)、
[LangChain.js](https://github.com/langchain-ai/langchainjs)（文本切分）、
[AnythingLLM](https://github.com/Mintplex-Labs/anything-llm)（知识库设计）、
[UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)、
[Lume](https://github.com/trycua/cua)、[Electron](https://www.electronjs.org)、
[React](https://react.dev) 和 [Vite](https://vite.dev)。
