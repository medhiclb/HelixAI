<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.png" />
    <img src="docs/images/logo-light.png" alt="Helix AI のロゴ" height="120" />
  </picture>
</p>

<h1 align="center">Helix AI</h1>

<p align="center">
  <strong>自分のマシンで動く、自分たちだけの AI ワークスペース。</strong><br />
  チャット、エージェント、コーディング、ナレッジベース、ファインチューニングを 1 つのオープンソースのデスクトップアプリに。
  文書と会話を手元に置いておきたいチームと組織のためのアプリです。
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.zh.md">中文</a> ·
  <strong>日本語</strong> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/medhiclb/HelixAI?label=release" /></a>
  <img alt="Platforms: macOS, Windows, Linux" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" />
  <img alt="インターフェース：英語、フランス語、中国語、日本語、スペイン語、ドイツ語、アラビア語" src="https://img.shields.io/badge/interface-EN%20%C2%B7%20FR%20%C2%B7%20ZH%20%C2%B7%20JA%20%C2%B7%20ES%20%C2%B7%20DE%20%C2%B7%20AR-success" />
  <a href="https://github.com/medhiclb/HelixAI/discussions"><img alt="Discussions" src="https://img.shields.io/badge/discussions-welcome-8a63d2" /></a>
</p>

<p align="center">
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-arm64.dmg"><img alt="macOS（Apple シリコン）版をダウンロード" src="https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-x64.dmg"><img alt="macOS（Intel）版をダウンロード" src="https://img.shields.io/badge/macOS-Intel-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-Setup-2026.1004.1-x64.exe"><img alt="Windows（x64）版をダウンロード" src="https://img.shields.io/badge/Windows-x64-0a5fb4?style=for-the-badge&logo=windows&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/helix-plateforme_2026.1004.1_amd64.deb"><img alt="Ubuntu、Debian 版（.deb）をダウンロード" src="https://img.shields.io/badge/Ubuntu%20%2F%20Debian-.deb-c2410c?style=for-the-badge&logo=ubuntu&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1.AppImage"><img alt="Linux 版（AppImage）をダウンロード" src="https://img.shields.io/badge/Linux-AppImage-3f3f46?style=for-the-badge&logo=linux&logoColor=white" /></a>
</p>

<p align="center">
  <a href="#インストール">インストール</a>
  · <a href="#スクリーンショット">スクリーンショット</a>
  · <a href="#機能">機能</a>
  · <a href="#ソースからビルド">ソースからビルド</a>
  · <a href="#コントリビューション">コントリビューション</a>
</p>

<p align="center">
  <img src="docs/images/ja/demo.gif" alt="仕入先の見積書を添付したチャットでの質問。回答には、引用した社内ハンドブックの箇所が添えられています" width="900" />
</p>

<p align="center"><sub>添付した仕入先の見積書についての質問に、会社のナレッジベースをもとに出典付きで回答しています。</sub></p>

## Helix AI を選ぶ理由

- **既定でローカル。** モデルは [LM Studio](https://lmstudio.ai) のエンジンを通じて、お使いのマシンまたは
  組織のサーバーで動作します。Helix AI はこのエンジンを、マシンのメモリに合ったモデルとともにインストールします。
  クラウドのモデルが勝手に選ばれることはありません。
- **キーを登録しない限り、何も外に出ません。** 会話がクラウドのプロバイダーに送られるのは、そのプロバイダーの
  API キーを追加し、そのモデルのいずれかを選んだ場合だけです。モデルの選択画面には、各モデルがどこで動作するかが
  表示されます。ご自身で接続したサービス（クラウドのキー、メールボックス、Drive、Slack など）と、オンにした
  Chat のウェブ検索（質問は DuckDuckGo に送られます）を除けば、
  アプリがインターネットに接続するのは、インストールするもの（エンジン、モデル、ツール）のダウンロードと、
  新しいバージョンの確認（Helix AI は GitHub、OpenClaw は npm）のときだけです。
- **オープンソースで、購入するものはありません。** AGPL-3.0。私たちのアカウントは不要で、テレメトリーも
  ありません。各組織が自分のインスタンスをインストールして運用します。
- **macOS、Windows、Linux。** 3 つのシステムで同じ 1 つのアプリが動き、英語、フランス語、中国語、日本語、
  スペイン語、ドイツ語、アラビア語に対応しています。
- **働き続けるエージェント。** 独自のナレッジベースとスケジュールされたミッションを持つエージェントは、
  ウィンドウを閉じていても動作し、実行ごとにレポートを残します。何かを変更する操作は、別の設定にしない限り、
  人の承認を待ちます。
- **アプリからファインチューニング。** 質問と回答の例をもとに小さなオープンモデルに会社の事実を学習させ、
  元のモデルと比較してから、チャットで使えます（Apple シリコンでは MLX）。
- **チームのために。** アカウント、グループ、グループごとに共有するナレッジベース、2 要素認証、監査ログ、
  保存データの暗号化。

## スクリーンショット

<table>
  <tr>
    <td width="50%"><img src="docs/images/ja/chat.png" alt="ナレッジベースをもとに回答するチャット。見積書が添付され、回答の下に引用元が表示されています" /></td>
    <td width="50%"><img src="docs/images/ja/home.png" alt="ホーム画面。最近のチャットと、マシン上のモデルが表示されています" /></td>
  </tr>
  <tr>
    <td align="center">ナレッジベースと添付ファイルを使ったチャットと、その出典</td>
    <td align="center">ホーム</td>
  </tr>
  <tr>
    <td><img src="docs/images/ja/code.png" alt="作業中の Helix Code：タスクリスト、ファイルの読み取りと編集、実行中のテストコマンド" /></td>
    <td><img src="docs/images/ja/agents.png" alt="常時稼働のエージェントと、スケジュールされたミッションのレポート" /></td>
  </tr>
  <tr>
    <td align="center">作業中の Helix Code</td>
    <td align="center">常時稼働のエージェントとミッションのレポート</td>
  </tr>
  <tr>
    <td><img src="docs/images/ja/compare.png" alt="モデルを比較：Epoch AI の能力スコアと発行元の価格" /></td>
    <td><img src="docs/images/ja/usage.png" alt="自分の使用量：モデルごとのリクエスト、トークン、費用。ローカルモデルには API 料金がかかりません" /></td>
  </tr>
  <tr>
    <td align="center">モデルを比較（スコアと価格）</td>
    <td align="center">自分の使用量</td>
  </tr>
  <tr>
    <td><img src="docs/images/ja/knowledge.png" alt="ナレッジベースと、インデックス化された文書" /></td>
    <td><img src="docs/images/ja/training.png" alt="モデルをトレーニング：質問と回答の例" /></td>
  </tr>
  <tr>
    <td align="center">ナレッジベース</td>
    <td align="center">モデルをトレーニング</td>
  </tr>
</table>

## インストール

お使いのシステム用のパッケージを
[v2026.1004.1 リリース](https://github.com/medhiclb/HelixAI/releases/tag/v2026.1004.1)からダウンロードしてください。
SHA-256 チェックサム：[`SHA256SUMS.txt`](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/SHA256SUMS.txt)。

| プラットフォーム | ダウンロード | インストール方法 |
|---|---|---|
| **macOS**（Apple シリコン） | [Helix-2026.1004.1-arm64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-arm64.dmg) | ディスクイメージを開き、Helix をアプリケーションフォルダーにドラッグします。初回起動時：「システム設定」›「プライバシーとセキュリティ」›「このまま開く」 |
| **macOS**（Intel） | [Helix-2026.1004.1-x64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-x64.dmg) | 上と同じです。ローカルモデルは、Helix が自動でインストールする llama.cpp で動きます。 |
| **Windows 10/11**（x64） | [Helix-Setup-2026.1004.1-x64.exe](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-Setup-2026.1004.1-x64.exe) | インストーラーを実行します（管理者権限は不要です）。SmartScreen が表示された場合：「詳細情報」›「実行」 |
| **Ubuntu、Debian**（x64） | [helix-plateforme_2026.1004.1_amd64.deb](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/helix-plateforme_2026.1004.1_amd64.deb) | `sudo apt install ./helix-plateforme_2026.1004.1_amd64.deb` |
| **その他の Linux**（x64） | [Helix-2026.1004.1.AppImage](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1.AppImage) | `chmod +x Helix-2026.1004.1.AppImage` の後、実行します。Ubuntu 24.04 では `.deb` をおすすめします |

**macOS ではコマンド 1 つで**（推奨）：ディスクイメージを `SHA256SUMS.txt` とコード署名で確認したうえで、
Gatekeeper の確認なしにアプリがインストールされます。

```bash
curl -fsSL https://raw.githubusercontent.com/medhiclb/HelixAI/main/scripts/installer-macos.sh | sh
```

初回起動時に、Helix AI は必要なものを準備します。LM Studio のヘッドレスエンジン（固定バージョン、
チェックサム検証済み）、またはマシンですでに使われている場合は LM Studio アプリ、そしてマシンに最も適した
モデルです。メモリは 16 GB を推奨します。それより小さいマシンでは、より軽いモデルが選ばれます。Python、Node、
および Helix Code 用の [OpenCode](https://github.com/anomalyco/opencode) は、ない場合にワンクリックで
インストールされます（固定バージョン、チェックサム検証済み）。チャットモデルは LM Studio のカタログから、
LM Studio が提供するバージョンで取得します。

新しいバージョンはアプリ内でお知らせします。macOS ではワンクリックで更新できます。Windows と Linux では
新しいパッケージが提示され、以前のものの上にインストールされます。データはそのまま残ります。アプリが公証される
までは、新しいバージョンのたびに一度、macOS が Helix にキーチェーンの項目（「Helix Safe Storage」）への
アクセスを許可するか確認します。「常に許可」を選んでください。Windows 11 では、スマート アプリ コントロールが
有効な場合、署名のないアプリはブロックされ、そのまま実行する選択肢も表示されません。

Windows では、「自由」レベルの常時稼働エージェントの
コマンドは PowerShell で実行されます。

## 機能

- **チャット**：**マシンごとに選ばれた**ローカルモデルで。Helix AI は、小さなノートパソコンから
  ワークステーションまで、メモリに収まる最も評価の高いオープンモデル（Apache 2.0 または MIT）を
  インストールし、動かせるほかのモデルも提案します。カタログには Qwen、Mistral（Magistral、Ministral）、
  OpenAI gpt-oss、Z.ai GLM、IBM Granite、Ai2 OLMo、Meta、DeepSeek が含まれます。クラウドモデルは
  ご自身の API キーで使えます。添付ファイル、音声入力（Whisper、マシン上）、画像生成（Z-Image Turbo、
  FLUX.2 klein）、短い動画（Wan 2.1 と 2.2）も、マシン上で動作します。回答の生成中に送ったメッセージは、回答を途中で止めずに順番を待ちます。
- **モデルを比較**：使えるすべてのモデルを、能力スコアと発行元の価格で配置します。ローカルモデルとクラウドの
  モデルを 1 つのグラフで比べられます。
- **Chat でのウェブ検索**：「+」メニューからオンにすると、外すまでチップとして表示されます。質問は DuckDuckGo に
  送られ、インスタンスが見つかったページを開き、回答には出典がリンクで示されます。ページはデータとして読まれ、
  指示として扱われることはありません。管理者はインスタンス全体で無効にできます。
- **ナレッジベース（RAG）**：文書をまとめると、インスタンスがマシン上でインデックス化し、回答では使った箇所が
  引用されます。各人が見つけられるのは、閲覧が許可された文書だけです。
- **Cowork**：ファイルに対して、またあなたの承認のもとで仮想デスクトップ（LibreOffice、ブラウザー）上で
  作業し、Word、Excel、PowerPoint、PDF の文書を作成するエージェント。
- **Helix Code**：プロジェクトフォルダーで動くコードエージェント（OpenCode ベース）。タスク、コマンド、
  編集したファイルをリアルタイムで表示するパネル付きです。**VS Code**（拡張機能は各[リリース](https://github.com/medhiclb/HelixAI/releases/latest)に添付。「Install from VSIX…」でインストール）でも、
  **`helix` コマンドライン**でターミナルからも使えます。macOS と Linux のクラウドモデルでは、コマンドの出力をまず
  [RTK](https://github.com/rtk-ai/rtk) で短くしてトークンを節約します。承認カードには元のコマンドが
  そのまま表示されます。
- **コネクタ**：メール、Google カレンダー（読み書き）、Google ドライブ、Slack、Notion、MCP サーバー。
  すべて**承認の仕組み**を経由し、何かを変更する操作はあなたの了承なしには行われません。
  LinkedIn はプロフィールを、さらに 2 つ目の LinkedIn アプリで会社ページを接続できます。
  Palmier Pro（Apple シリコン搭載 Mac 向けの動画編集ソフト）は、インスタンスの Mac で開いている間、
  エージェントがそのタイムライン上で編集できます。
- **スケジュールタスク**：指示と頻度（毎日、月曜日から金曜日、週または月の特定の日）を設定すると、
  ウィンドウを閉じていても、選んだエージェントがあなたのツールで実行します。
- **常時稼働のエージェント**：スケジュールされたミッション、受信メールやメッセージングアプリへの返信を、
  それぞれのナレッジベースと写真とともに。受信したメールは権限を減らして処理され、Web では、エージェントは
  すでに見たアドレスしか開きません。
- **モデルをトレーニング**：例、トレーニング、元のモデルとの比較、そして LM Studio へのインストール
  （Apple シリコンでは MLX、NVIDIA カードでは Unsloth）。
- **自分の使用量**：モデルごとのリクエストとトークンを、各エンジンの応答から読み取ります。ローカルモデルには
  API 料金がかからず、クラウドのモデルは、ご自身の料金またはプロバイダーが公表している日付入りの価格で
  計算されます。
- **開発者 API**：インスタンスの OpenAI 互換 API（`/v1/models`、`/v1/chat/completions`、ナレッジベースを含む）
  のための個人用 API キー。あなたの名前で動作し、それ以上のことはできず、いつでもすぐに取り消せます。
- **会議**：録音またはインポート、マシン上での文字起こしと議事録、会議ボット。
- **インポート**：ChatGPT、Claude、Gemini（Google データエクスポート）、Claude Code、Codex、Cursor の履歴を引き継ぎます。
- **チーム**：アカウント、グループ、共有、2 要素認証、監査ログ、GDPR エクスポート、保存データの暗号化。
- **ホワイトラベル**：製品名、ロゴ、色は 1 つの設定ファイルで決まります。

## ソースからビルド

前提条件：macOS（Apple シリコンまたは Intel）、Windows 10/11、または Linux（x64）、Node.js 22.18 以降と npm。
Node が必要なのはビルドと開発のときだけです。ゲートウェイは TypeScript を直接実行し、インストールされた
アプリには Node も Python も不要です。

```bash
git clone https://github.com/medhiclb/HelixAI
cd HelixAI
npm install
npm run app
```

`npm run app` はゲートウェイをビルドし、デスクトップアプリを開きます。デスクトップアプリは自身のローカル
ゲートウェイを起動します。Web インターフェースだけを使う場合は、2 つのターミナルで `npm run gateway` と
`npm run dev` を実行します。

```bash
npm run package      # macOS：release/ に .dmg と .zip
npx electron-builder --win nsis --x64            # Windows インストーラー（npm run build の後）
npx electron-builder --linux AppImage deb --x64  # Linux パッケージ（npm run build の後）
npm run typecheck    # インターフェースとゲートウェイ
npm run securite     # 使い捨てのインスタンスに対するセキュリティチェック
```

署名と公証の準備はできており、Apple の証明書を待つだけです。[SIGNATURE.md](SIGNATURE.md) を参照してください。

### コマンドライン

デスクトップアプリには `helix` コマンドが付属しています。**「設定」›「アプリのインストール」› CLI** で
設定してから（Windows では、そのあと新しい PowerShell かコマンド プロンプトを開きます）、次のように使います。

```bash
helix connexion          # インスタンスのアカウントで一度ログイン
helix chat               # ターミナルでチャット
helix chat --outils      # コネクタ付きで、承認の仕組みを経由して
helix code               # 現在のフォルダーでコードエージェント
```

### ドキュメント

技術ドキュメントはフランス語で書かれています。[docs/GUIDE.md](docs/GUIDE.md)（ゲートウェイ、ルート、
コネクタ、デプロイ、リブランディング）、[ARCHITECTURE.md](ARCHITECTURE.md)、[SECURITE.md](SECURITE.md)、
[SCREENS.md](SCREENS.md)（すべての画面と、それぞれが実際に行うこと）、[PROJET.md](PROJET.md)（意図、
決定事項、現在の状態）。

## コントリビューション

誤字の修正から新しいコネクタまで、コントリビューションを歓迎します。

- [CONTRIBUTING.md](CONTRIBUTING.md) をお読みいただき、最初のプルリクエストの前に [CLA](CLA.md) に署名して
  ください。
- 質問やアイデア：[Discussions](https://github.com/medhiclb/HelixAI/discussions)。
- バグや機能の要望：[Issues](https://github.com/medhiclb/HelixAI/issues)、またはアプリの「設定」›「問題を報告」から。
  Issue またはメールが用意されるので、ご自身で確認して送信してください。
- セキュリティ上の脆弱性：非公開で報告してください。[SECURITY.md](SECURITY.md) を参照してください。
- [行動規範](CODE_OF_CONDUCT.md)。

## ライセンス

[GNU AGPL-3.0](LICENSE)。Helix AI は使用、変更、再配布、販売ができます。配布する人、またはオンライン
サービスとして提供する人は、自分のバージョンのコードを同じライセンスで公開しなければなりません。
詳細は [COPYRIGHT.md](COPYRIGHT.md) にあります。

既定のモデルエンジンである LM Studio はクローズドソースのソフトウェアで、その利用規約で認められているのは
個人利用と組織内部での利用であり、他者へのサービス提供は認められていません。他者のためにインスタンスを
ホストする前に、[PROJET.md § 3.9](PROJET.md) をお読みください。

## 謝辞

「モデルを比較」のモデルのスコアは **Epoch AI** の
[Capabilities & benchmarking](https://epoch.ai/benchmarks/use-this-data)（Epoch Capabilities Index）によるもので、
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) の下で提供され、2026 年 9 月 27 日に取得しました。
価格は各発行元の料金ページから、同じ日に記録したものです。

多くのオープンソースの成果をもとに作られています。その一部：
[OpenCode](https://github.com/anomalyco/opencode)、
[RTK](https://github.com/rtk-ai/rtk)、
[OpenClaw](https://github.com/openclaw/openclaw)、
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)、
[MLX](https://github.com/ml-explore/mlx)、
[Unsloth](https://github.com/unslothai/unsloth)、
[Whisper](https://github.com/openai/whisper)、
[Qwen](https://github.com/QwenLM)、
[LangChain.js](https://github.com/langchain-ai/langchainjs)（テキスト分割）、
[AnythingLLM](https://github.com/Mintplex-Labs/anything-llm)（ナレッジベースの設計）、
[UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)、
[Lume](https://github.com/trycua/cua)、[Electron](https://www.electronjs.org)、
[React](https://react.dev)、[Vite](https://vite.dev)。
