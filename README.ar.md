<div dir="rtl">

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.png" />
    <img src="docs/images/logo-light.png" alt="شعار Helix AI" height="120" />
  </picture>
</p>

<h1 align="center">Helix AI</h1>

<p align="center">
  <strong>مساحة عملك الخاصة للذكاء الاصطناعي، على أجهزتك أنت.</strong><br />
  Chat والوكلاء والبرمجة وقواعد المعرفة وتدريب النماذج في تطبيق واحد مفتوح المصدر لسطح المكتب،
  للفرق والمؤسسات التي تريد أن تبقى مستنداتها ومحادثاتها عندها.
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <strong>العربية</strong>
</p>

<p align="center" dir="ltr">
  <a href="LICENSE"><img alt="الترخيص: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/latest"><img alt="أحدث إصدار" src="https://img.shields.io/github/v/release/medhiclb/HelixAI?label=release" /></a>
  <img alt="المنصات: macOS وWindows وLinux" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" />
  <img alt="الواجهة: الإنجليزية والفرنسية والصينية واليابانية والإسبانية والألمانية والعربية" src="https://img.shields.io/badge/interface-EN%20%C2%B7%20FR%20%C2%B7%20ZH%20%C2%B7%20JA%20%C2%B7%20ES%20%C2%B7%20DE%20%C2%B7%20AR-success" />
  <a href="https://github.com/medhiclb/HelixAI/discussions"><img alt="النقاشات" src="https://img.shields.io/badge/discussions-welcome-8a63d2" /></a>
</p>

<p align="center" dir="ltr">
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-arm64.dmg"><img alt="تنزيل لنظام macOS (Apple Silicon)" src="https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-x64.dmg"><img alt="تنزيل لنظام macOS (Intel)" src="https://img.shields.io/badge/macOS-Intel-111111?style=for-the-badge&logo=apple&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-Setup-2026.1004.2-x64.exe"><img alt="تنزيل لنظام Windows (x64)" src="https://img.shields.io/badge/Windows-x64-0a5fb4?style=for-the-badge&logo=windows&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/helix-plateforme_2026.1004.2_amd64.deb"><img alt="تنزيل لنظامي Ubuntu وDebian (.deb)" src="https://img.shields.io/badge/Ubuntu%20%2F%20Debian-.deb-c2410c?style=for-the-badge&logo=ubuntu&logoColor=white" /></a>
  <a href="https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2.AppImage"><img alt="تنزيل لنظام Linux (AppImage)" src="https://img.shields.io/badge/Linux-AppImage-3f3f46?style=for-the-badge&logo=linux&logoColor=white" /></a>
</p>

<p align="center">
  <a href="#التثبيت">التثبيت</a>
  · <a href="#لقطات-الشاشة">لقطات الشاشة</a>
  · <a href="#الميزات">الميزات</a>
  · <a href="#البناء-من-المصدر">البناء من المصدر</a>
  · <a href="#المساهمة">المساهمة</a>
</p>

<p align="center">
  <img src="docs/images/ar/demo.gif" alt="سؤال مطروح في Chat مع عرض سعر من مورّد مرفق به؛ يصل الجواب مع المقاطع التي يستشهد بها من دليل الشركة" width="900" />
</p>

<p align="center"><sub>سؤال عن عرض سعر مرفق من مورّد، أُجيب عنه من قاعدة المعرفة الخاصة بالشركة، مع مصادره.</sub></p>

## لماذا Helix AI

- **محلي افتراضيًا.** تعمل النماذج على جهازك أو على خادم مؤسستك، عبر محرك
  [LM Studio](https://lmstudio.ai) الذي يثبّته Helix AI مع النموذج الذي يناسب ذاكرة الجهاز.
  لا يُختار لك أبدًا نموذج سحابي.
- **لا شيء يخرج من دون مفتاح تضيفه أنت.** لا تذهب المحادثة إلى مزوّد سحابي إلا إذا أضفت مفتاح
  API الخاص بذلك المزوّد واخترت أحد نماذجه؛ ويبيّن منتقي النماذج أين يعمل كل نموذج. وباستثناء
  الخدمات التي تربطها بنفسك (مفتاح سحابي، صندوق بريد، Drive، Slack…) والبحث على الويب في Chat
  حين تفعّله (تذهب أسئلتك عندئذ إلى DuckDuckGo)، لا يتصل التطبيق بالإنترنت إلا لتنزيل ما يثبّته
  (المحرك والنماذج والأدوات) وللبحث عن الإصدارات الجديدة (إصدارات Helix AI على GitHub،
  وإصدارات OpenClaw على npm).
- **مفتوح المصدر، ولا شيء يُشترى.** ترخيص AGPL-3.0، بلا حساب لدينا، وبلا قياس عن بُعد. كل
  مؤسسة تثبّت مثيلها الخاص وتشغّله.
- **macOS وWindows وLinux.** تطبيق واحد للأنظمة الثلاثة، بالإنجليزية والفرنسية والصينية
  واليابانية والإسبانية والألمانية والعربية.
- **وكلاء يواصلون العمل.** الوكلاء، ولهم قواعد معرفتهم الخاصة ومهماتهم المجدولة، يعملون
  والنافذة مغلقة ويتركون تقريرًا عن كل تشغيل؛ وكل ما يغيّر شيئًا ينتظر موافقة شخص، إلا إذا
  قررت غير ذلك.
- **تدريب النماذج من داخل التطبيق.** علّم نموذجًا مفتوحًا صغيرًا معلومات شركتك من أمثلة أسئلة
  وأجوبة، وقارنه بالأصل، ثم استخدمه في Chat (MLX على Apple Silicon).
- **مصمَّم للفرق.** حسابات، ومجموعات، وقواعد معرفة مشتركة حسب المجموعة، والمصادقة الثنائية،
  وسجل تدقيق، وبيانات مشفّرة وهي مخزّنة.

## لقطات الشاشة

<table>
  <tr>
    <td width="50%"><img src="docs/images/ar/chat.png" alt="Chat يجيب من قاعدة معرفة، مع ملف PDF مرفق والمصادر المستشهد بها تحت الجواب" /></td>
    <td width="50%"><img src="docs/images/ar/home.png" alt="الشاشة الرئيسية، مع آخر محادثات Chat والنموذج الموجود على الجهاز" /></td>
  </tr>
  <tr>
    <td align="center">Chat مع قاعدة معرفة ومرفق ومصادره</td>
    <td align="center">الرئيسية</td>
  </tr>
  <tr>
    <td><img src="docs/images/ar/code.png" alt="Helix Code أثناء العمل: قائمة المهام، وملفات مقروءة ومعدّلة، وأمر اختبار قيد التشغيل" /></td>
    <td><img src="docs/images/ar/agents.png" alt="وكيل دائم العمل وتقارير مهماته المجدولة" /></td>
  </tr>
  <tr>
    <td align="center">Helix Code أثناء العمل</td>
    <td align="center">وكلاء دائمو العمل وتقارير مهماتهم</td>
  </tr>
  <tr>
    <td><img src="docs/images/ar/compare.png" alt="مقارنة النماذج: درجة القدرات من Epoch AI مقابل سعر الناشر" /></td>
    <td><img src="docs/images/ar/usage.png" alt="استخدامي: الطلبات والرموز والتكلفة لكل نموذج، والنماذج المحلية بلا رسوم API" /></td>
  </tr>
  <tr>
    <td align="center">مقارنة النماذج (الدرجة مقابل السعر)</td>
    <td align="center">استخدامي</td>
  </tr>
  <tr>
    <td><img src="docs/images/ar/knowledge.png" alt="قاعدة معرفة ومستنداتها المفهرسة" /></td>
    <td><img src="docs/images/ar/training.png" alt="تدريب نموذج: أمثلة أسئلة وأجوبة" /></td>
  </tr>
  <tr>
    <td align="center">قواعد المعرفة</td>
    <td align="center">تدريب نموذج</td>
  </tr>
</table>

## التثبيت

نزّل الحزمة المناسبة لنظامك من
[الإصدار v2026.1004.2](https://github.com/medhiclb/HelixAI/releases/tag/v2026.1004.2).
مجاميع التحقق SHA-256: [`SHA256SUMS.txt`](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/SHA256SUMS.txt).

| المنصة | التنزيل | التثبيت |
|---|---|---|
| <span dir="ltr">**macOS** (Apple Silicon)</span> | [Helix-2026.1004.2-arm64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-arm64.dmg) | افتح صورة القرص واسحب Helix إلى مجلد التطبيقات. عند أول تشغيل: إعدادات النظام › الخصوصية والأمان › «فتح على أي حال» |
| <span dir="ltr">**macOS** (Intel)</span> | [Helix-2026.1004.2-x64.dmg](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2-x64.dmg) | كما في السطر السابق. تعمل النماذج المحلية على llama.cpp، الذي يثبّته Helix بنفسه. |
| <span dir="ltr">**Windows 10/11** (x64)</span> | [Helix-Setup-2026.1004.2-x64.exe](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-Setup-2026.1004.2-x64.exe) | شغّل برنامج التثبيت (لا حاجة إلى صلاحيات المسؤول). إذا ظهر SmartScreen: «مزيد من المعلومات» › «التشغيل على أي حال» |
| <span dir="ltr">**Ubuntu, Debian** (x64)</span> | [helix-plateforme_2026.1004.2_amd64.deb](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/helix-plateforme_2026.1004.2_amd64.deb) | <code dir="ltr">sudo apt install ./helix-plateforme_2026.1004.2_amd64.deb</code> |
| **توزيعات Linux الأخرى** <span dir="ltr">(x64)</span> | [Helix-2026.1004.2.AppImage](https://github.com/medhiclb/HelixAI/releases/download/v2026.1004.2/Helix-2026.1004.2.AppImage) | <code dir="ltr">chmod +x Helix-2026.1004.2.AppImage</code> ثم شغّله. على Ubuntu 24.04، يُفضَّل ملف <code dir="ltr">.deb</code> |

**macOS، بأمر واحد** (موصى به): يُثبَّت التطبيق من دون رسالة Gatekeeper، بعد التحقق من صورة
القرص مقابل `SHA256SUMS.txt` ومن توقيعها البرمجي:

<div dir="ltr">

```bash
curl -fsSL https://raw.githubusercontent.com/medhiclb/HelixAI/main/scripts/installer-macos.sh | sh
```

</div>

عند أول تشغيل، يجهّز Helix AI ما يحتاج إليه: محرك LM Studio الذي يعمل بلا واجهة (إصدار مثبَّت،
ومجموع تحقق تم التحقق منه)، أو تطبيق LM Studio إذا كان مستخدمًا على الجهاز أصلًا، والنموذج الأنسب
للجهاز. يُنصح بذاكرة قدرها 16 GB؛ وعلى الأجهزة الأصغر يُختار نموذج أخف. أما Python وNode، وكذلك
[OpenCode](https://github.com/anomalyco/opencode) من أجل Helix Code، فتُثبَّت بنقرة واحدة عند
غيابها (إصدارات مثبَّتة، ومجاميع تحقق تم التحقق منها)؛ ويأتي نموذج المحادثة من فهرس LM Studio،
بالإصدار الذي يقدّمه LM Studio.

تُعلَن الإصدارات الجديدة داخل التطبيق: نقرة واحدة على macOS؛ وعلى Windows وLinux تُعرض الحزمة
الجديدة وتُثبَّت فوق السابقة، وتبقى بياناتك محفوظة. وإلى أن يُوثَّق التطبيق لدى Apple، يسأل macOS
مرة واحدة بعد كل إصدار جديد عن السماح لـ Helix بالوصول إلى عنصره في سلسلة المفاتيح
(«Helix Safe Storage»): اختر «السماح دائمًا». على Windows 11، يحظر Smart App Control، حين يكون
مفعّلًا، التطبيقات غير الموقّعة ولا يعرض تشغيلها على أي حال.

على Windows، تمرّ أوامر الوكيل الدائم العمل في
المستوى «حر» عبر PowerShell.

## الميزات

- **Chat** مع نماذج محلية **تُختار لكل جهاز**: يثبّت Helix AI أفضل نموذج مفتوح تقييمًا
  (Apache 2.0 أو MIT) تتسع له ذاكرة الجهاز، من حاسوب محمول صغير إلى محطة عمل، ويقترح النماذج
  الأخرى التي يستطيع الجهاز تشغيلها. يشمل الفهرس Qwen وMistral (Magistral وMinistral) وOpenAI
  gpt-oss وZ.ai GLM وIBM Granite وAi2 OLMo وMeta وDeepSeek. تعمل النماذج السحابية بمفتاح API
  الخاص بك. المرفقات، والإملاء (Whisper، على الجهاز)، وتوليد الصور (Z-Image Turbo وFLUX.2
  klein)، والفيديوهات القصيرة (Wan 2.1 و2.2)، على الجهاز أيضًا. الرسالة التي تُرسَل أثناء كتابة
  جواب تنتظر دورها بدل أن تقطعه.
- **مقارنة النماذج**: كل نموذج يمكنك استخدامه، موضوعًا بحسب درجة قدراته مقابل السعر الذي يطلبه
  ناشره، ليمكن الموازنة بين نموذج محلي ونموذج سحابي على مخطط واحد.
- **البحث على الويب في Chat**: فعّله من القائمة <span dir="ltr">« + »</span> فيبقى على شكل
  شارة إلى أن تزيله. تذهب الأسئلة إلى DuckDuckGo، ويفتح مثيلك الصفحات التي عُثر عليها، ويسرد
  الجواب مصادره على شكل روابط. تُقرأ الصفحات على أنها بيانات، لا تعليمات أبدًا؛ ويستطيع المسؤول
  إيقافه للمثيل كله.
- **قواعد المعرفة (RAG)**: اجمع المستندات، فيفهرسها المثيل على الجهاز، وتستشهد الأجوبة
  بالمقاطع التي تستخدمها. لا يجد كل شخص إلا المستندات المسموح له برؤيتها.
- **Cowork**: وكيل يعمل على ملفاتك، وبموافقتك، على سطح مكتب افتراضي (LibreOffice، متصفح)
  لإنتاج مستندات Word وExcel وPowerPoint وPDF.
- **Helix Code**: وكيل شيفرة يعمل على مجلد مشروعك (مبني على OpenCode)، مع لوحة مباشرة لمهامه
  وأوامره والملفات المعدّلة؛ وهو متاح أيضًا في **VS Code** (الإضافة مرفقة بكل
  [إصدار](https://github.com/medhiclb/HelixAI/releases/latest)؛ ثبّتها عبر <span dir="ltr">«Install from VSIX…»</span>) وفي
  الطرفية عبر **سطر الأوامر `helix`**. على macOS وLinux، مع نموذج سحابي، يمرّ خرج أوامره أولًا
  عبر [RTK](https://github.com/rtk-ai/rtk) لاستهلاك رموز أقل؛ وتبقى بطاقة الموافقة تعرض الأمر
  كما كُتب.
- **الموصّلات**: البريد، وGoogle Calendar (قراءة وكتابة)، وGoogle Drive، وSlack، وNotion،
  وخوادم MCP، خلف **حاجز الموافقة**: لا يحدث شيء يغيّر شيئًا من دون إذنك. يربط LinkedIn ملفًا
  شخصيًا، وعبر تطبيق LinkedIn ثانٍ، صفحة شركة؛ أما Palmier Pro، وهو محرر فيديو لأجهزة Mac
  العاملة بشرائح Apple silicon، فيتيح للوكلاء التحرير على خطه الزمني ما دام مفتوحًا على جهاز
  Mac الخاص بالمثيل.
- **المهام المجدولة**: تعليمة وإيقاع (كل يوم، من الاثنين إلى الجمعة، يوم من الأسبوع أو من
  الشهر)، تُنفَّذ بأدواتك، حتى والنافذة مغلقة، على يد الوكيل الذي تختاره.
- **وكلاء دائمو العمل**: مهمات مجدولة، وردود على البريد الوارد وعلى تطبيقات المراسلة، مع قواعد
  معرفتهم الخاصة وصورتهم. يُعالَج البريد المستلَم بصلاحيات مخفّضة: على الويب، لا يفتح الوكيل إلا
  العناوين التي سبق أن رآها.
- **تدريب نموذج**: أمثلة، ثم تدريب، ثم مقارنة بالأصل، ثم تثبيت في LM Studio (MLX على
  Apple Silicon، وUnsloth على بطاقات NVIDIA).
- **استخدامي**: الطلبات والرموز لكل نموذج، مقروءة من أجوبة كل محرك؛ النماذج المحلية لا تكلّف
  رسوم API، والنماذج السحابية تُسعَّر بتعرفتك أو بالسعر المنشور لدى المزوّد، مع تاريخه.
- **API للمطوّرين**: مفاتيح API شخصية لواجهة API الخاصة بالمثيل والمتوافقة مع OpenAI
  (<code dir="ltr">/v1/models</code> و<code dir="ltr">/v1/chat/completions</code>، وقواعد
  المعرفة مشمولة)، باسمك أنت لا أكثر، ويمكن إبطالها فورًا.
- **الاجتماعات**: تسجيل أو استيراد، ونسخ نصي ومحضر على الجهاز، وروبوت اجتماعات.
- **استيراد** سجلّك من ChatGPT وClaude وGemini (Google Takeout) وClaude Code وCodex وCursor.
- **الفرق**: حسابات، ومجموعات، ومشاركة، والمصادقة الثنائية، وسجل تدقيق، وتصدير وفق اللائحة
  العامة لحماية البيانات (GDPR)، وبيانات مشفّرة وهي مخزّنة.
- **العلامة البيضاء**: اسم المنتج وشعاره وألوانه تأتي من ملف إعداد واحد.

## البناء من المصدر

المتطلبات: macOS (Apple Silicon أو Intel) أو Windows 10/11 أو Linux (x64)، وNode.js 22.18 أو
أحدث، وnpm. لا حاجة إلى Node إلا للبناء والتطوير: تشغّل البوابة ملفات TypeScript الخاصة بها
مباشرة، والتطبيق المثبَّت لا يحتاج إلى Node ولا إلى Python.

<div dir="ltr">

```bash
git clone https://github.com/medhiclb/HelixAI
cd HelixAI
npm install
npm run app
```

</div>

يبني `npm run app` البوابة ويفتح تطبيق سطح المكتب، الذي يشغّل بوابته المحلية الخاصة. أما واجهة
الويب وحدها فتعمل بالأمرين `npm run gateway` و`npm run dev` في طرفيتين.

<div dir="ltr">

```bash
npm run package      # macOS: ملفا .dmg و .zip في release/
npx electron-builder --win nsis --x64            # برنامج تثبيت Windows (بعد npm run build)
npx electron-builder --linux AppImage deb --x64  # حزم Linux (بعد npm run build)
npm run typecheck    # الواجهة والبوابة
npm run securite     # فحوص الأمان على مثيل مؤقت
```

</div>

التوقيع والتوثيق لدى Apple جاهزان ولا ينتظران إلا شهادة من Apple: انظر
[SIGNATURE.md](SIGNATURE.md).

### سطر الأوامر

يأتي تطبيق سطح المكتب بالأمر `helix`. أعدّه من **الإعدادات › تثبيت التطبيقات › CLI** (على Windows، افتح بعدها نافذة PowerShell أو موجّه أوامر جديدة)، ثم:

<div dir="ltr">

```bash
helix connexion          # سجّل الدخول مرة واحدة بحسابك على المثيل
helix chat               # Chat في الطرفية
helix chat --outils      # مع موصّلاتك، خلف حاجز الموافقة
helix code               # وكيل الشيفرة على المجلد الحالي
```

</div>

### التوثيق

التوثيق التقني مكتوب بالفرنسية: [docs/GUIDE.md](docs/GUIDE.md) (البوابة، والمسارات،
والموصّلات، والنشر، وتغيير العلامة)، و[ARCHITECTURE.md](ARCHITECTURE.md)،
و[SECURITE.md](SECURITE.md)، و[SCREENS.md](SCREENS.md) (كل شاشة وما تفعله حقًا)،
و[PROJET.md](PROJET.md) (المقاصد، والقرارات، والحالة الراهنة).

## المساهمة

المساهمات مرحَّب بها، من خطأ مطبعي إلى موصّل جديد.

- اقرأ [CONTRIBUTING.md](CONTRIBUTING.md)، ووقّع [CLA](CLA.md) قبل أول طلب سحب (pull request)
  لك.
- الأسئلة والأفكار: [Discussions](https://github.com/medhiclb/HelixAI/discussions).
- الأخطاء وطلبات الميزات: [Issues](https://github.com/medhiclb/HelixAI/issues)، أو من داخل
  التطبيق: الإعدادات › الإبلاغ عن مشكلة، وهو يجهّز بلاغًا (issue) أو رسالة بريد تراجعها وترسلها
  بنفسك.
- الثغرات الأمنية: أبلغ عنها بشكل خاص، انظر [SECURITY.md](SECURITY.md).
- [مدونة السلوك](CODE_OF_CONDUCT.md).

## الترخيص

[GNU AGPL-3.0](LICENSE). يحق لك استخدام Helix AI وتعديله وإعادة توزيعه وبيعه. ومن يوزّعه، أو
يقدّمه كخدمة على الإنترنت، عليه أن ينشر شيفرة نسخته تحت الترخيص نفسه. التفاصيل في
[COPYRIGHT.md](COPYRIGHT.md).

LM Studio، وهو محرك النماذج الافتراضي، برنامج مغلق المصدر تسمح شروطه بالاستخدام الشخصي
وبالاستخدام الداخلي في المؤسسة، لا بتقديم خدمة للآخرين: اقرأ
[PROJET.md § 3.9](PROJET.md) قبل أن تستضيف مثيلًا لغيرك.

## شكر وتقدير

درجات النماذج في «مقارنة النماذج» مصدرها **Epoch AI**،
[Capabilities & benchmarking](https://epoch.ai/benchmarks/use-this-data) (Epoch Capabilities
Index)، بترخيص [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)، وقد استُرجعت في
27 سبتمبر 2026. والأسعار مصدرها صفحات التسعير لدى الناشرين أنفسهم، وقد سُجّلت في اليوم نفسه.

بُني بالاعتماد على أعمال مفتوحة المصدر، منها:
[OpenCode](https://github.com/anomalyco/opencode)،
[RTK](https://github.com/rtk-ai/rtk)،
[OpenClaw](https://github.com/openclaw/openclaw)،
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)،
[MLX](https://github.com/ml-explore/mlx)،
[Unsloth](https://github.com/unslothai/unsloth)،
[Whisper](https://github.com/openai/whisper)،
[Qwen](https://github.com/QwenLM)،
[LangChain.js](https://github.com/langchain-ai/langchainjs) (مقسّم النصوص)،
[AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) (تصميم قواعد المعرفة)،
[UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)،
[Lume](https://github.com/trycua/cua)، [Electron](https://www.electronjs.org)،
[React](https://react.dev) و[Vite](https://vite.dev).

</div>
