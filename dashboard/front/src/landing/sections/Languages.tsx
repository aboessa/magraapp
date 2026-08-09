import { useState } from 'react'
import { Ico } from '../icons'
import { LANG_SAMPLE, STORY_CLIPS } from '../structure'
import type { LangCode } from '../structure'
import { useCopy } from '../useContent'
import { AudioPlayer } from './AudioPlayer'

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
  const clip = STORY_CLIPS[audioLang]
  const text = useCopy().languages

  return (
    <section className="mj-section" id="languages" data-section="languages">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">{text.kicker}</span>
          <h2>{text.heading}</h2>
          <p>{text.copy}</p>
        </div>

        <div className="mj-lang-demo mj-reveal">
          <div>
            <div className="mj-lang-row">
              <b>{text.textLang}</b>
              <Segmented label={text.textLang} value={textLang} onChange={setTextLang} />
            </div>
            <div className="mj-lang-row">
              <b>{text.audioLang}</b>
              <Segmented label={text.audioLang} value={audioLang} onChange={setAudioLang} />
            </div>

            <p className="mj-lang-hint">{text.hint}</p>

            <div className="mj-inline-chips">
              {text.chips.map((chip) => <span className="mj-chip" key={chip}>{chip}</span>)}
            </div>
          </div>

          <div className="mj-lang-out">
            <p
              className="mj-lang-txt"
              lang={textLang}
              dir={sample.dir}
              style={{ textAlign: sample.dir === 'rtl' ? 'right' : 'left' }}
            >
              {sample.text}
            </p>

            <div className="mj-lang-aud">
              <Ico name="speakerFull" />
              <span>{text.audioPrefix} {LANG_SAMPLE[audioLang].label}</span>
            </div>

            {/* تسجيل حقيقي لكل لغة، فتغيير لغة الصوت يغيّر ما يُسمع فعلًا */}
            <AudioPlayer
              src={clip.src}
              waveform={clip.waveform}
              durationSeconds={clip.durationSeconds}
              label={text.narrationOf(LANG_SAMPLE[audioLang].label)}
              idleText={text.idleText}
            />

            <div className="mj-lang-src">{text.source}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
