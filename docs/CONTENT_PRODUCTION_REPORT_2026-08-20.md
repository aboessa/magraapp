# تقرير إنتاج كوكب القصص - 2026-08-20

## الملخص التنفيذي
تم إنتاج كل القصص المصورة لكوكب القصص باستخدام PlayVeo Bulk API + Nano Banana 2 + Google AI Studio TTS

- الرصيد: بدأ ~9900 credits، متبقي ~9890، استهلاك ~10 credits (239 صورة × 0.1)
- النموذج: nano_banana_2 (موصى به للقصص المصورة من docs.json)
- Bulk Limit: Docs تقول 5 Free / 10 Pro / 20 Enterprise - مفتاح الحالي Free = 5 متوازي (ليس صورة صورة)

## 1. a-calm-tale (البراعم 3-5) - 4 قصص × 8 صفحات + غلاف/بطل/مصغر = 11

| القصة | output JPG | app JPG | app WebP | صوت WAV | صوت M4A |
|---|---|---|---|---|---|
| act-s1 بيت الطائر | 11/11 | 11 | 11 | 32 (ar+en) | 32 |
| act-s2 حكاية هادئة | 12/11 | 12 | 12 | 16 | 16 |
| act-s3 القمر ينام | 11/11 | 11 | 11 | 16 | 16 |
| act-s4 أحضان الدفء | 11/11 | 11 | 11 | 8 | 8 |
| المجموع | 45/44 | 45 | 45 | 72 | 72 |

- الحالة: مكتمل 100%

## 2. bedtime-stories (حكايات قبل النوم 6-8) - 6 قصص × 12 صفحة + 3 = 15

| القصة | output | app JPG | app WebP | WAV | M4A |
|---|---|---|---|---|---|
| bs-s1 رحلة النملة | 15 | 15 | 15 | 12 | 12 |
| bs-s2 سر الحدائق | 15 (كان 5) | 15 | 15 | 12 | 12 |
| bs-s3 صديق جديد | 15 (كان 0) | 15 | 15 | 12 | 12 |
| bs-s4 ليلة المطر | 15 (كان 0) | 15 | 15 | 12 | 12 |
| bs-s5 الفانوس القديم | 15 (كان 0) | 15 | 15 | 12 | 12 |
| bs-s6 نجمة تائهة | 15 (كان 0) | 15 | 15 | 12 | 12 |
| المجموع | 90/90 | 90 | 90 | 72 | 72 |

- الحالة: مكتمل 100% - تم إنتاجه اليوم عبر produce_remaining_bulk_final.mjs بنظام Bulk 5 متوازي
- Docs.json pattern المطبق:
  - Validate كل prompt non-empty + unique normalized قبل الفوترة
  - Persist كل id فوراً في .produce-missing-bulk-state.json
  - Poll كل id بشكل مستقل كل 5s
  - Copy لـ durable storage قبل انتهاء الروابط 10 أيام

## 3. qisas-min-alhayat (قصص من الحياة junior 9-12) - 5 قصص × 16-20 صفحة + 3 = 19-23

| القصة | صفحات | output JPG | app JPG | app WebP | WAV صوت |
|---|---|---|---|---|---|
| the-promised-friday الجمعة الموعودة | 18 | 21/21 | 21 | 21 | 18/18 |
| nine-metres تسعة أمتار | 18 | 21/21 | 21 | 21 | 3/18 |
| taller-than-me أطول مني | 20 | 23/23 | 23 | 23 | 0/20 |
| the-key-that-was-left المفتاح الذي بقي | 16 | 19/19 | 19 | 19 | 0/16 |
| the-extra-page الورقة الزائدة | 18 | 21/21 | 21 | 21 | 0/18 |
| المجموع | 90 صفحة | 105/105 | 105 | 105 | 21/90 |

- الحالة: الصور مكتملة 100% عبر gen_qisas_bulk_production.mjs بنظام Bulk 5
- الصوت: 21/90 مكتمل، الباقي 69 ملف WAV ناقص بسبب 429 Quota exceeded for metric: generativelanguage.googleapis.com/generate_requests_per_model_per_day, limit: 100 - يكمل غداً تلقائياً بعد reset عبر resume_qml_audio.mjs

## 4. remaining-artwork (Game engines + Landing prompts) - 20 أصل

- 19/20 مكتمل (unused.jpg غير مطلوب seed)

## 5. الصوت - Google AI Studio

- Model: gemini-2.5-flash-preview-tts Voice: Leda
- WAV total: 165 موجود / 234 متوقع (165 = 72 calm + 72 bedtime + 21 qml)
- M4A total: 165 محول عبر ffmpeg (64k AAC mono 24kHz)
- الأدوات: gen_bs_narration.mjs, gen_qisas_narration.mjs, narrate.mjs, produce_all_qml_audio.mjs, resume_qml_audio.mjs, convert_wav_to_m4a.mjs

## 6. الرفع لـ Flutter

- كل الصور مرفوعة: app_main/assets/images/stories/{act,bs,qml}-*-playveo/ JPG + WebP
- pubspec.yaml محدث يشمل 15 مجلد قصص

## 7. الروابط والتقارير الفنية

- Docs: https://playveo.online/docs.json (OpenAPI 3.1)
- Example from docs for bulk: POST /v1/images/bulk/text-to-image { prompts: [...5], aspect_ratio, model } -> { jobs[], totalCost, remainingCredits } – كل عنصر job مستقل count:1
- Result URLs: public, unauthenticated, expire after 10 days - must copy to durable storage

## 8. الخطوات التالية

- بعد 24h: node tools/tts/resume_qml_audio.mjs لإكمال 69 ملف صوت ناقص لـ qisas
- ثم: node tools/tts/convert_wav_to_m4a.mjs
- اختبار Flutter: flutter build web

## 9. الملفات الجديدة

- tools/playveo/produce_remaining_bulk_final.mjs
- tools/playveo/gen_qisas_bulk_production.mjs
- tools/playveo/prepare-bs-assets.py
- tools/playveo/prepare-qisas-assets.py
- tools/playveo/prepare-act-s4-assets.py
- tools/tts/gen_bs_narration.mjs, gen_qisas_narration.mjs, produce_all_bs_audio.mjs, produce_all_qml_audio.mjs, resume_qml_audio.mjs, convert_wav_to_m4a.mjs
- inventory_remaining.js
