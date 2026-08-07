import { useState } from 'react'
import { Ico } from '../icons'
import { LANG_SAMPLE } from '../data'
import type { LangCode } from '../data'

const CODES: LangCode[] = ['ar', 'en', 'fr']

function Segmented({
  label,
  value,
  onChange,
}: {
  label: string
  value: LangCode
  onChange: (code: LangCode) => void
}) {
  return (
    <div className="mj-seg" role="group" aria-label={label}>
      {CODES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={code === value}
          onClick={() => onChange(code)}
        >
          {LANG_SAMPLE[code].label}
        </button>
      ))}
    </div>
  )
}

export function Languages() {
  const [textLang, setTextLang] = useState<LangCode>('ar')
  const [audioLang, setAudioLang] = useState<LangCode>('en')
  const sample = LANG_SAMPLE[textLang]

  return (
    <section className="mj-section" id="languages" data-section="languages">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">ثلاث لغات</span>
          <h2>اللغة لا تتوقف عند الواجهة</h2>
          <p>
            في مجرة تمتد اللغة إلى الفيديو والقصة والصوت والنص. يمكن لطفلك أن يقرأ بلغة ويستمع بأخرى،
            أو يبدّل في أي وقت دون أن يفقد موضعه.
          </p>
        </div>

        <div className="mj-lang-demo mj-reveal">
          <div>
            <div className="mj-lang-row">
              <b>لغة النص</b>
              <Segmented label="لغة النص" value={textLang} onChange={setTextLang} />
            </div>
            <div className="mj-lang-row">
              <b>لغة الصوت</b>
              <Segmented label="لغة الصوت" value={audioLang} onChange={setAudioLang} />
            </div>

            <p className="mj-lang-hint">
              اقرأ بالعربية واستمع بالإنجليزية، أو بدّل اللغة في أي وقت.
              الإعداد يُحفظ لكل ملف طفل على حدة، ويطبَّق على القصص والحلقات والصوتيات.
            </p>

            <div className="mj-inline-chips">
              <span className="mj-chip">ترجمة مكتوبة للحلقات</span>
              <span className="mj-chip">دبلجة صوتية للقصص</span>
              <span className="mj-chip">واجهة RTL و LTR كاملة</span>
            </div>
          </div>

          <div className="mj-lang-out">
            <p
              className="mj-lang-txt"
              dir={sample.dir}
              style={{ textAlign: sample.dir === 'rtl' ? 'right' : 'left' }}
            >
              {sample.text}
            </p>
            <div className="mj-lang-aud">
              <Ico name="speakerFull" />
              <span>الصوت: {LANG_SAMPLE[audioLang].label} · صوت الراوي</span>
            </div>
            <div className="mj-lang-src">المثال من قصة «في الطبيعة» · صفحة 4 من 22</div>
          </div>
        </div>
      </div>
    </section>
  )
}
