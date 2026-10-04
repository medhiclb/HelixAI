<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.png" />
    <img src="docs/images/logo-light.png" alt="Logotipo de Helix AI" height="120" />
  </picture>
</p>

<h1 align="center">Helix AI</h1>

<p align="center">
  <strong>Tu propio espacio de trabajo de IA, en tus propias máquinas.</strong><br />
  Chat, agentes, código, bases de conocimiento y entrenamiento de modelos en una sola aplicación
  de escritorio de código abierto, para los equipos y las organizaciones que quieren conservar en
  casa sus documentos y sus conversaciones.
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <strong>Español</strong> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ar.md">العربية</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="Licencia: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/latest"><img alt="Última versión" src="https://img.shields.io/github/v/release/medhiclb/HelixAI?label=release" /></a>
  <img alt="Plataformas: macOS, Windows, Linux" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" />
  <img alt="Interfaz: inglés, francés, chino, japonés, español, alemán, árabe" src="https://img.shields.io/badge/interface-EN%20%C2%B7%20FR%20%C2%B7%20ZH%20%C2%B7%20JA%20%C2%B7%20ES%20%C2%B7%20DE%20%C2%B7%20AR-success" />
  <a href="https://github.com/medhiclb/HelixAI/discussions"><img alt="Discusiones" src="https://img.shields.io/badge/discussions-welcome-8a63d2" /></a>
</p>

<p align="center">
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-arm64.dmg"><img alt="Descargar para macOS (Apple Silicon)" src="https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-x64.dmg"><img alt="Descargar para macOS (Intel)" src="https://img.shields.io/badge/macOS-Intel-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-Setup-2026.1004.1-x64.exe"><img alt="Descargar para Windows (x64)" src="https://img.shields.io/badge/Windows-x64-0a5fb4?style=for-the-badge&logo=windows&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/helix-plateforme_2026.1004.1_amd64.deb"><img alt="Descargar para Ubuntu y Debian (.deb)" src="https://img.shields.io/badge/Ubuntu%20%2F%20Debian-.deb-c2410c?style=for-the-badge&logo=ubuntu&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1.AppImage"><img alt="Descargar para Linux (AppImage)" src="https://img.shields.io/badge/Linux-AppImage-3f3f46?style=for-the-badge&logo=linux&logoColor=white" /></a>
</p>

<p align="center">
  <a href="#instalación">Instalación</a>
  · <a href="#capturas">Capturas</a>
  · <a href="#funciones">Funciones</a>
  · <a href="#compilar-desde-el-código-fuente">Compilar desde el código fuente</a>
  · <a href="#contribuir">Contribuir</a>
</p>

<p align="center">
  <img src="docs/images/es/demo.gif" alt="Una pregunta hecha en un Chat con el presupuesto de un proveedor adjunto; la respuesta llega con los pasajes del manual de la empresa que cita" width="900" />
</p>

<p align="center"><sub>Una pregunta sobre el presupuesto adjunto de un proveedor, respondida a partir de la base de conocimiento de la empresa, con sus fuentes.</sub></p>

## Por qué Helix AI

- **Local por defecto.** Los modelos se ejecutan en tu máquina o en el servidor de tu
  organización, con el motor de [LM Studio](https://lmstudio.ai), que Helix AI instala junto con
  el modelo que cabe en la memoria de la máquina. Nunca se elige por ti un modelo en la nube.
- **Nada sale sin una clave que tú conectes.** Una conversación solo va a un proveedor en la nube
  si añades la clave de API de ese proveedor y eliges uno de sus modelos; el selector de modelos
  indica dónde se ejecuta cada uno. Aparte de los servicios que conectas tú mismo (una clave en
  la nube, un buzón de correo, Drive, Slack…) y de la búsqueda en la web del Chat cuando la
  activas (tus preguntas van entonces a DuckDuckGo), la aplicación solo se conecta a internet
  para descargar lo que instala (motor, modelos, herramientas) y para consultar si hay versiones
  nuevas (de Helix AI en GitHub, de OpenClaw en npm).
- **Código abierto, nada que comprar.** AGPL-3.0, sin cuenta con nosotros, sin telemetría. Cada
  organización instala y gestiona su propia instancia.
- **macOS, Windows y Linux.** Una sola aplicación para los tres sistemas, en inglés, francés,
  chino, japonés, español, alemán y árabe.
- **Agentes que siguen trabajando.** Los agentes, con sus propias bases de conocimiento y sus
  misiones programadas, trabajan con la ventana cerrada y dejan un informe de cada ejecución;
  todo lo que modifica algo espera la aprobación de una persona, salvo que decidas otra cosa.
- **Entrenamiento desde la aplicación.** Enseña a un pequeño modelo abierto los datos de tu
  empresa a partir de ejemplos de preguntas y respuestas, compáralo con el original y úsalo
  después en el Chat (MLX en Apple Silicon).
- **Pensado para equipos.** Cuentas, grupos, bases de conocimiento compartidas por grupo,
  autenticación de dos factores, un registro de auditoría y datos cifrados en reposo.

## Capturas

<table>
  <tr>
    <td width="50%"><img src="docs/images/es/chat.png" alt="Un Chat que responde a partir de una base de conocimiento, con un PDF adjunto y las fuentes citadas bajo la respuesta" /></td>
    <td width="50%"><img src="docs/images/es/home.png" alt="La pantalla de inicio, con los Chats recientes y el modelo de la máquina" /></td>
  </tr>
  <tr>
    <td align="center">Chat con una base de conocimiento, un archivo adjunto y sus fuentes</td>
    <td align="center">Inicio</td>
  </tr>
  <tr>
    <td><img src="docs/images/es/code.png" alt="Helix Code en acción: lista de tareas, archivos leídos y modificados, un comando de prueba en ejecución" /></td>
    <td><img src="docs/images/es/agents.png" alt="Un agente siempre activo y los informes de sus misiones programadas" /></td>
  </tr>
  <tr>
    <td align="center">Helix Code en acción</td>
    <td align="center">Agentes siempre activos y los informes de sus misiones</td>
  </tr>
  <tr>
    <td><img src="docs/images/es/compare.png" alt="Comparar los modelos: puntuación de capacidades de Epoch AI frente al precio del editor" /></td>
    <td><img src="docs/images/es/usage.png" alt="Mi uso: solicitudes, tokens y coste por modelo, los modelos locales sin gastos de API" /></td>
  </tr>
  <tr>
    <td align="center">Comparar los modelos (puntuación frente a precio)</td>
    <td align="center">Mi uso</td>
  </tr>
  <tr>
    <td><img src="docs/images/es/knowledge.png" alt="Una base de conocimiento y sus documentos indexados" /></td>
    <td><img src="docs/images/es/training.png" alt="Entrenar un modelo: ejemplos de preguntas y respuestas" /></td>
  </tr>
  <tr>
    <td align="center">Bases de conocimiento</td>
    <td align="center">Entrenar un modelo</td>
  </tr>
</table>

## Instalación

Descarga el paquete para tu sistema desde la
[versión v2026.1004.1](https://github.com/medhiclb/HelixAI/releases/tag/v2026.1004.1).
Sumas de comprobación SHA-256: [`SHA256SUMS.txt`](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/SHA256SUMS.txt).

| Plataforma | Descarga | Instalación |
|---|---|---|
| **macOS** (Apple Silicon) | [Helix-2026.1004.1-arm64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-arm64.dmg) | Abre la imagen de disco y arrastra Helix a Aplicaciones. En el primer inicio: Ajustes del Sistema › Privacidad y seguridad › «Abrir igualmente» |
| **macOS** (Intel) | [Helix-2026.1004.1-x64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1-x64.dmg) | Igual que arriba. Los modelos locales funcionan con llama.cpp, que Helix instala por sí mismo. |
| **Windows 10/11** (x64) | [Helix-Setup-2026.1004.1-x64.exe](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-Setup-2026.1004.1-x64.exe) | Ejecuta el instalador (no hacen falta derechos de administrador). Si aparece SmartScreen: «Más información» › «Ejecutar de todas formas» |
| **Ubuntu, Debian** (x64) | [helix-plateforme_2026.1004.1_amd64.deb](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/helix-plateforme_2026.1004.1_amd64.deb) | `sudo apt install ./helix-plateforme_2026.1004.1_amd64.deb` |
| **Otras distribuciones Linux** (x64) | [Helix-2026.1004.1.AppImage](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.1/Helix-2026.1004.1.AppImage) | `chmod +x Helix-2026.1004.1.AppImage` y después ejecútalo. En Ubuntu 24.04, mejor el `.deb` |

**macOS, en un solo comando** (recomendado): la aplicación se instala sin el aviso de
Gatekeeper, después de comprobar la imagen de disco con `SHA256SUMS.txt` y su firma de código:

```bash
curl -fsSL https://raw.githubusercontent.com/medhiclb/HelixAI/main/scripts/installer-macos.sh | sh
```

En el primer inicio, Helix AI prepara lo que necesita: el motor sin interfaz de LM Studio
(versión fijada, suma de comprobación verificada), o la aplicación LM Studio si ya se usa en la
máquina, y el modelo que mejor se adapta a ella. Se recomiendan 16 GB de memoria; en máquinas
más pequeñas se elige un modelo más ligero. Python, Node y, para Helix Code,
[OpenCode](https://github.com/anomalyco/opencode) se instalan con un clic cuando faltan
(versiones fijadas, sumas de comprobación verificadas); el modelo de chat procede del catálogo
de LM Studio, en la versión que LM Studio sirve.

Las versiones nuevas se anuncian en la aplicación: un clic en macOS; en Windows y Linux se
ofrece el paquete nuevo, que se instala sobre el anterior, y tus datos se conservan. Mientras la
aplicación no esté notarizada, macOS pregunta una vez después de cada versión nueva si Helix
puede acceder a su elemento del llavero («Helix Safe Storage»): elige «Permitir siempre». En
Windows 11, Smart App Control, cuando está activo, bloquea las aplicaciones sin firmar y no
ofrece ejecutarlas de todas formas.

En Windows, los comandos de un agente
siempre activo en el nivel «Libre» pasan por PowerShell.

## Funciones

- **Chat** con modelos locales **elegidos para cada máquina**: Helix AI instala el modelo abierto
  mejor valorado (Apache 2.0 o MIT) que cabe en su memoria, desde un portátil pequeño hasta una
  estación de trabajo, y propone los demás que puede ejecutar. El catálogo incluye Qwen, Mistral
  (Magistral, Ministral), OpenAI gpt-oss, Z.ai GLM, IBM Granite, Ai2 OLMo, Meta y DeepSeek. Los
  modelos en la nube funcionan con tu propia clave de API. Archivos adjuntos, dictado (Whisper,
  en la máquina), generación de imágenes (Z-Image Turbo, FLUX.2 klein) y vídeos cortos (Wan 2.1
  y 2.2), también en la máquina. Un mensaje enviado mientras aún se escribe una respuesta espera
  su turno en lugar de interrumpirla.
- **Comparar los modelos**: todos los modelos que puedes usar, situados según su puntuación de
  capacidades frente al precio que cobra su editor, para poder sopesar en un mismo gráfico un
  modelo local y uno en la nube.
- **Búsqueda en la web en el Chat**: actívala desde el menú « + » y se queda como una etiqueta
  hasta que la quites. Las preguntas van a DuckDuckGo, tu instancia abre las páginas encontradas
  y la respuesta enumera sus fuentes en forma de enlaces. Las páginas se leen como datos, nunca
  como instrucciones; un administrador puede desactivarla para toda la instancia.
- **Bases de conocimiento (RAG)**: reúne documentos, la instancia los indexa en la máquina y las
  respuestas citan los pasajes que utilizan. Cada persona solo encuentra los documentos que
  tiene permiso para ver.
- **Cowork**: un agente que trabaja sobre tus archivos y, con tu aprobación, en un escritorio
  virtual (LibreOffice, navegador) para producir documentos Word, Excel, PowerPoint y PDF.
- **Helix Code**: un agente de código sobre la carpeta de tu proyecto (basado en OpenCode), con
  un panel en directo de sus tareas, sus comandos y los archivos modificados; también en
  **VS Code** (la extensión se adjunta a cada
  [versión](https://github.com/medhiclb/HelixAI/releases/latest); instálala con «Install from VSIX…») y en el
  terminal con la **línea de comandos `helix`**. En macOS y Linux, con un modelo en la nube, la
  salida de sus comandos pasa primero por [RTK](https://github.com/rtk-ai/rtk), para gastar
  menos tokens; la tarjeta de aprobación sigue mostrando el comando tal como está escrito.
- **Conectores**: correo, Google Calendar (lectura y escritura), Google Drive, Slack, Notion y
  servidores MCP, detrás de una **barrera de aprobación**: nada que modifique algo ocurre sin tu
  visto bueno. LinkedIn conecta un perfil y, mediante una segunda aplicación de LinkedIn, una
  página de empresa; Palmier Pro, un editor de vídeo para los Mac con Apple Silicon, permite a
  los agentes editar en su línea de tiempo mientras está abierto en el Mac de la instancia.
- **Tareas programadas**: una instrucción y un ritmo (cada día, de lunes a viernes, un día de la
  semana o del mes), ejecutadas con tus herramientas, incluso con la ventana cerrada, por el
  agente que elijas.
- **Agentes siempre activos**: misiones programadas, respuestas al correo entrante y a las
  aplicaciones de mensajería, con sus propias bases de conocimiento y su foto. Un correo recibido
  se trata con derechos reducidos: en la web, el agente solo abre direcciones que ya ha visto.
- **Entrenar un modelo**: ejemplos, entrenamiento, comparación con el original y, después,
  instalación en LM Studio (MLX en Apple Silicon, Unsloth en tarjetas NVIDIA).
- **Mi uso**: solicitudes y tokens por modelo, leídos en las respuestas de cada motor; los
  modelos locales no tienen gastos de API, y los de la nube se valoran con tu tarifa o con el
  precio publicado por el proveedor, con fecha.
- **API para desarrolladores**: claves de API personales para la API de la instancia, compatible
  con OpenAI (`/v1/models`, `/v1/chat/completions`, bases de conocimiento incluidas), a tu
  nombre y nada más, revocables al instante.
- **Reuniones**: grabación o importación, transcripción y acta en la máquina, bot de reuniones.
- **Importar** tu historial de ChatGPT, Claude, Gemini (Google Takeout), Claude Code, Codex y Cursor.
- **Equipos**: cuentas, grupos, uso compartido, autenticación de dos factores, registro de
  auditoría, exportación RGPD, datos cifrados en reposo.
- **Marca blanca**: el nombre del producto, el logotipo y los colores salen de un único archivo
  de configuración.

## Compilar desde el código fuente

Requisitos: macOS (Apple Silicon o Intel), Windows 10/11 o Linux (x64), Node.js 22.18 o posterior
y npm. Node solo hace falta para compilar y desarrollar: la pasarela ejecuta su TypeScript
directamente, y la aplicación instalada no necesita ni Node ni Python.

```bash
git clone https://github.com/medhiclb/HelixAI
cd HelixAI
npm install
npm run app
```

`npm run app` compila la pasarela y abre la aplicación de escritorio, que inicia su propia
pasarela local. La interfaz web sola se lanza con `npm run gateway` y `npm run dev` en dos
terminales.

```bash
npm run package      # macOS: .dmg y .zip en release/
npx electron-builder --win nsis --x64            # instalador de Windows (después de npm run build)
npx electron-builder --linux AppImage deb --x64  # paquetes de Linux (después de npm run build)
npm run typecheck    # interfaz y pasarela
npm run securite     # controles de seguridad contra una instancia desechable
```

La firma y la notarización están listas y solo esperan un certificado de Apple: consulta
[SIGNATURE.md](SIGNATURE.md).

### Línea de comandos

La aplicación de escritorio incluye el comando `helix`. Configúralo desde
**Ajustes › Instalar las apps › CLI** (en Windows, abre después un nuevo PowerShell o Símbolo del sistema) y después:

```bash
helix connexion          # inicia sesión una vez con tu cuenta de la instancia
helix chat               # un Chat en el terminal
helix chat --outils      # con tus conectores, detrás de la barrera de aprobación
helix code               # el agente de código sobre la carpeta actual
```

### Documentación

La documentación técnica está escrita en francés: [docs/GUIDE.md](docs/GUIDE.md) (pasarela,
rutas, conectores, despliegue, cambio de marca), [ARCHITECTURE.md](ARCHITECTURE.md),
[SECURITE.md](SECURITE.md), [SCREENS.md](SCREENS.md) (cada pantalla y lo que hace realmente) y
[PROJET.md](PROJET.md) (intenciones, decisiones, estado actual).

## Contribuir

Las contribuciones son bienvenidas, desde una errata hasta un conector nuevo.

- Lee [CONTRIBUTING.md](CONTRIBUTING.md) y firma el [CLA](CLA.md) antes de tu primera pull
  request.
- Preguntas e ideas: [Discussions](https://github.com/medhiclb/HelixAI/discussions).
- Errores y peticiones de funciones: [Issues](https://github.com/medhiclb/HelixAI/issues), o
  desde la aplicación: Ajustes › Informar de un problema, que prepara una issue o un correo que
  tú revisas y envías.
- Vulnerabilidades de seguridad: comunícalas en privado, consulta [SECURITY.md](SECURITY.md).
- [Código de conducta](CODE_OF_CONDUCT.md).

## Licencia

[GNU AGPL-3.0](LICENSE). Puedes usar, modificar, redistribuir y vender Helix AI. Quien lo
distribuya, o lo ofrezca como servicio en línea, debe publicar el código de su versión bajo la
misma licencia. Detalles en [COPYRIGHT.md](COPYRIGHT.md).

LM Studio, el motor de modelos por defecto, es un software de código cerrado cuyas condiciones
permiten el uso personal y el uso interno de una organización, no un servicio prestado a
terceros: lee [PROJET.md § 3.9](PROJET.md) antes de alojar una instancia para otros.

## Agradecimientos

Las puntuaciones de los modelos en «Comparar los modelos» proceden de **Epoch AI**,
[Capabilities & benchmarking](https://epoch.ai/benchmarks/use-this-data) (Epoch Capabilities
Index), bajo licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), consultadas el
27 de septiembre de 2026. Los precios proceden de las páginas de tarifas de los propios
editores, anotados el mismo día.

Construido con trabajo de código abierto, entre otros:
[OpenCode](https://github.com/anomalyco/opencode),
[RTK](https://github.com/rtk-ai/rtk),
[OpenClaw](https://github.com/openclaw/openclaw),
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp),
[MLX](https://github.com/ml-explore/mlx),
[Unsloth](https://github.com/unslothai/unsloth),
[Whisper](https://github.com/openai/whisper),
[Qwen](https://github.com/QwenLM),
[LangChain.js](https://github.com/langchain-ai/langchainjs) (divisor de texto),
[AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) (diseño de las bases de conocimiento),
[UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
[Lume](https://github.com/trycua/cua), [Electron](https://www.electronjs.org),
[React](https://react.dev) y [Vite](https://vite.dev).
