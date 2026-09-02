# نظام الأفاتار الجديد – Majarra Premium Avatars

## المشكلة اللي كانت موجودة

الصور في `app_main/assets/avatars/characters/` **لم تكن مصممة كأفاتار** أصلاً.

كانت عملية Crop تلقائية بإحداثيات ثابتة من Character Sheets (1376x768) باستخدام `tools/generate_avatars.mjs` القديم.

النتيجة:
- وجه مقصوص
- خلفية بيضاء بتطلع في الدائرة
- BoxFit.cover بيقص الوجه غلط
- شاشة "من يشاهد الآن؟" + picker كلهم مش مظبوطين

شوفت ده في الصورتين اللي بعتها – فعلاً القص غلط جداً.

---

## الحل المؤقت السريع (تم تنفيذه الآن ✅)

### 1. إعادة توليد الأفاتار بشكل صحيح

سكربت جديد: `tools/fix_avatars_v3_clean.mjs`

يعمل:
- ✅ ياخد Head فقط (مش Full Body) من Bottom Row في كل Sheet
- ✅ يشيل الخلفية البيضاء aggressive (أي pixel أبيض/رمادي فاتح -> شفاف)
- ✅ يحط خلفية Navy Premium radial gradient `#1E2E6B -> #0A1128`
- ✅ يعمل Shadow تحت الشخصية
- ✅ يطلع 1024x1024 مربع جاهز لـ ClipOval
- ✅ الوجه 72-78% من الفريم – مناسب للدائرة

النتيجة: الوجه في النص، مش مقصوص، خلفية Navy مش بيضاء.

### 2. إصلاح ويدجت العرض

`app_main/lib/features/child/presentation/widgets/child_avatars.dart`

`ChildAvatarView` الجديد:
- Gradient border + glow shadow بألوان الشخصية
- Stack: background radial gradient + portrait + vignette
- Alignment.center للكل (لأن الصور الجديدة متوسطة)
- Fallback حرف أول مع gradient لو الصورة فشلت

`_avatarAlignment` كله بقي `Alignment.center` لأنه الصور الجديدة 1:1 face-centered.

### 3. إصلاح شاشة "من يشاهد الآن؟"

`child_switcher_page.dart`

شال الـ double Container اللي كان بيعمل ClipOval مرتين ويقص غلط. دلوقتي يستخدم `ChildAvatarView` مباشرة.

---

## الحل النهائي المثالي (محتاج توليد PlayVeo)

الأفاتار الحقيقي المثالي مش Crop من Sheet، لازم يكون **Portrait 1:1 Premium** متصمم كأفاتار من البداية.

Manifest جاهز: `tools/playveo/majarra-avatars.manifest.json`

فيه 24 أفاتار:

### Luna (براعم – كوكب أبجد)
- `luna-full.png` – الأساسي
- `luna-happy.png` – سعيدة
- `luna-excited.png` – متحمسة
- `luna-smile.png` – مبتسمة
- `luna-curious.png` – فضولية
- `luna-point.png` – تشير

### Nouma (أرقام)
- `nouma-full.png` + `nouma-happy.png` + `nouma-thinking.png` + `nouma-smile.png`

### Zaina (المستكشفون)
- `zaina-front.png` + `zaina-full.png` + `zaina-jump.png`

### Yaseen
- `yaseen-front.png` + `yaseen-full.png` + `yaseen-highfive.png`

### Salma (علوم)
- `salma-full.png`

### Addaad Robot
- `addaad-happy.png` + `thinking` + `learning` + `celebrating`

### Robo Junior
- `robo-analytical.png` + `robo-success.png` + `robo-curious.png`

كل Prompt فيه:
```
Premium square avatar portrait, 1:1 aspect, centered head and shoulders only,
close-up face filling 70% of frame, clean solid deep-navy background #0B1026
with subtle royal-blue rim light and soft cyan glow, soft stylized 3D Pixar style,
highly detailed expressive eyes, warm lighting, centered composition safe for
circular crop, ultra sharp, no full body, no legs, no waist below chest,
no background characters, no text, no logo...
Authentic Arab facial features...
```

Negative prompt يمنع full body, text, etc.

### طريقة التوليد

```bash
# Validate (no credits)
node tools/playveo/generate.mjs --manifest majarra-avatars.manifest.json --validate

# Generate 1 test
node tools/playveo/generate.mjs --manifest majarra-avatars.manifest.json --only avatar-luna

# Generate all (24 images) – cost ~2.4 credits (0.1 each)
node tools/playveo/generate.mjs --manifest majarra-avatars.manifest.json --rest

# Check output
ls app_main/assets/avatars/characters/
```

بعد التوليد، الصور هتبقي:
- 1024x1024 مربعة
- وجه 70% من الفريم
- خلفية Navy صلبة
- جاهزة للدائرة بدون أي قص غلط
- Pixar style premium

---

## ترتيب الأفاتار في الكود

`child_avatars.dart` فيه `ChildAvatars.all` – قائمة ثابتة.

النظام الحالي:
- `characters` = كل اللي مش planet
- `planets` = الكواكب
- `byId()` مع legacy map لـ `avatar-girl-1` etc.

لما تولد الجديد، استبدل الملفات بنفس الأسماء – الكود هيشتغل لوحده.

---

## Checklist للجودة

- [x] الوجه في النص (Alignment.center)
- [x] لا يوجد قص غلط
- [x] خلفية Navy مش بيضاء
- [x] 1:1 مربع
- [x] 70% وجه
- [ ] Pixar premium quality (محتاج PlayVeo)
- [x] ClipOval يعمل دائرة مضبوطة
- [x] Glow + border premium
- [ ] تنوع تعبيرات (happy, thinking, excited...)

---

## التالي

1. شغل `node tools/playveo/generate.mjs --manifest majarra-avatars.manifest.json --rest` لما يكون عندك credits
2. أو ابعت الصور لـ designer يرسمها يدوياً بنفس مواصفات البرومبت (1:1 portrait, navy bg, Pixar style)
3. لحد ما تولد، الصور الحالية v3 تعتبر "جيدة" ومش مقصوصة زي قبل

الصورتين اللي بعتها قبل كدا – المشكلة اتحلت: الوجه بقى في النص.
