# Games TTS — توليد الصوت العربي للألعاب عبر Google AI Studio

## المتطلبات
```bash
# احصل على مفتاح
https://aistudio.google.com/apikey

# خزنه
mkdir -p ~/.majarra
echo "YOUR_KEY" | tr -d '\r\n' > ~/.majarra/google-ai.key

# أو عبر env
$env:GOOGLE_AI_API_KEY = "YOUR_KEY"
```

## الاستخدام
```bash
# فحص جاف
node tools/tts/narrate.mjs --dry --manifest tools/tts/games/count-quantity-ar.json

# توليد كل الملفات
node tools/tts/narrate.mjs --all --manifest tools/tts/games/count-quantity-ar.json

# ملف واحد
node tools/tts/narrate.mjs --page 1 --manifest tools/tts/games/match-pairs-ar.json

# فحص جودة wav
node tools/tts/inspect-wav.mjs assets/audio/games/match-pairs/ar/*.wav
```

## الأصوات
| العمر | الصوت | الموديل | الأسلوب |
|-------|-------|---------|---------|
| 3-5 | Kore (دافئ هادئ) | gemini-3.1-flash-tts-preview | calm warm low |
| 6-8 | Leda (مرح شبابي) | gemini-3.1-flash-tts-preview | bright soft affectionate |
| 9-12 | Aoede (تعليمي واضح) | gemini-3.1-flash-tts-preview | clear educational steady |

## Manifests
كل engine له manifest منفصل في `tools/tts/games/`:
- `trace-color-shapes-ar.json` — أشكال 3-5
- `trace-color-numbers-ar.json` — أرقام
- `match-pairs-ar.json`, `sort-bins-ar.json`, `memory-flip-ar.json`
- `count-quantity-ar.json` — يتضمن 20 مقطع عد منفصل
- `sequence-order-ar.json`, `word-build-ar.json`
- `rhythm-tap-ar.json` (لا صوت لكن intro)
- `logic-pattern-ar.json`, `block-code-ar.json`, `sim-lab-ar.json`, `timeline-map-ar.json`
