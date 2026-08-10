/**
 * محرّرا `word_build` و`rhythm_tap`.
 *
 * ## word_build: الشكل يُستنتج ولا يُختار
 *
 * الخادم يرفض حرفًا عربيًا موسومًا بشكل لا يأخذه في كلمته، والسبب تعليمي لا
 * شكلي: لعبة تعرض «بـ» منفصلة في وسط كلمة تعلّم الطفل شكلًا لا يوجد في العربية
 * المكتوبة. القاعدة نفسها ليست بديهية — الحرف التالي لحرف لا يتّصل بما بعده
 * (ا د ذ ر ز و ...) يأخذ الشكل الأوّل لا الوسط — ومطالبة محرّر المحتوى بحفظها
 * لكل موضع في كل كلمة تعني أخطاءً مؤكَّدة.
 *
 * فالمحرّر هنا **يكتب الكلمة** فحسب: الحروف تُبنى منها بمواضعها وأشكالها
 * الصحيحة محسوبةً بـ`expectedArabicForm`، والشكل معروض للقراءة مع سبب اختياره.
 * ما يبقى على المحرّر هو الصوت لكل حرف — وهو ما لا يمكن استنتاجه.
 *
 * ## rhythm_tap: النقرات على شريط زمني لا في مصفوفة أرقام
 *
 * `notes` مصفوفة `{ time_ms, lane }`. تأليفها كأرقام يعني أن أحدًا لا يرى أن
 * نقرتين على 1200 و1210 مستحيلتان معًا، ولا أن النقرات تتوقّف في منتصف المقطوعة.
 * الشريط هنا يرسم المدّة الفعلية ومسارات اللعب وشبكة الإيقاع المشتقّة من
 * `bpm`، فتوضع النقرة على الضربة لا قريبًا منها.
 *
 * والالتصاق بالضربة ليس تجميلًا: العقد يشترط تزامنًا بدقّة ±20ms، ونقرة
 * بين ضربتين تُنتج لعبة تُطالب الطفل بإيقاع لا يسمعه.
 */

import { useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '../../Icon'
import { usePreferences } from '../../../context/preferences'
import { LETTER_POSITION_FORMS } from '../../../types/enginePack'
import type { LetterPositionForm, RhythmNote, RhythmTapLevel, WordBuildLevel, WordLetter } from '../../../types/enginePack'
import { NON_CONNECTING_AR, expectedArabicForm, wordChars } from '../../../lib/enginePack'
import { AssetField, EditorCard, EditorSection, confirmRemoval } from './fields'

const copy = {
  ar: {
    // word_build
    language: 'اللغة',
    languageHint: 'حزم هذا المحرّك تُؤلَّف لكل لغة ولا تُترجم أبدًا.',
    word: 'الكلمة',
    wordHint: 'من حرفين إلى خمسة. الحروف والخانات تُبنى منها تلقائيًا.',
    direction: 'اتجاه الكتابة',
    directions: { rtl: 'من اليمين إلى اليسار', ltr: 'من اليسار إلى اليمين' } as Record<string, string>,
    slots: 'الخانات',
    slotsLocked: 'تساوي عدد حروف الكلمة دائمًا: الخادم يرفض غير ذلك، فلا حقل لكتابتها.',
    wordAudio: 'الكلمة منطوقة',
    syllablesAudio: 'الكلمة مقطّعة',
    syllablesHint: 'مثل «قَ — مَ — ر». تُستخدم في الدرجة الثانية من سلّم المساعدة.',
    wordImage: 'صورة الكلمة',
    wordImageHint: 'صورة واحدة لا لبس فيها وبلا نصّ مطبوع: النصّ طبقة ترجمة.',
    showTextButton: 'زرّ إظهار الكلمة مكتوبة',
    showTextLocked: 'مفروض ولا يُطفأ: هو ما يجعل اللعبة قابلة للعب لمن لا يسمع.',
    letters: 'الحروف',
    lettersHint: 'تُبنى من الكلمة. الشكل محسوب، والصوت هو ما يبقى على المحرّر.',
    rebuild: 'أعد بناء الحروف من الكلمة',
    letterChar: 'الحرف',
    letterForm: 'الشكل في الكلمة',
    forms: { isolated: 'منفصل', initial: 'أوّل', medial: 'وسط', final: 'آخر' } as Record<LetterPositionForm, string>,
    formComputed: 'محسوب',
    formWhy: (previous: string) => `الحرف السابق «${previous}» لا يتّصل بما بعده، فهذا الحرف يأخذ الشكل الأوّل.`,
    formOverride: 'الشكل المسجَّل يخالف المحسوب، والخادم سيرفضه.',
    fixForm: 'صحّح الشكل',
    letterAudio: 'صوت الحرف',
    position: 'الموضع',
    distractors: 'الحروف المشتّتة',
    distractorsHint: 'حتى 3. تُختار من حروف قريبة صوتيًا أو شكليًا لا عشوائيًا، ولا يجوز أن تكون من حروف الكلمة.',
    addDistractor: 'حرف مشتّت',
    isInWord: 'هذا الحرف من حروف الكلمة: بطاقتان لا تُميَّزان، واحدة تُقبل وأخرى تُرفض.',
    preview: 'الكلمة كما ستُعرض',
    emptyWord: 'اكتب الكلمة أوّلًا.',
    remove: 'حذف',
    // rhythm_tap
    track: 'المقطوعة',
    trackHint: 'أصل صوتي بترخيص تجاري موثَّق: النشر محجوب حتى تُسجَّل الحقوق.',
    duration: 'مدّة المقطوعة (ms)',
    bpm: 'الإيقاع (bpm)',
    lanes: 'عدد المسارات',
    hitWindow: 'نافذة الإصابة (ms)',
    hitWindowHint: 'من 250 إلى 600، ولا تقلّ عن 450 لما قبل المدرسة و500 في الوضع الحركي المبسّط.',
    accuracy: 'الدقّة المطلوبة للنجاح',
    accuracyHint: 'من 0.4 إلى 0.8. لا فشل في هذه اللعبة: القيمة تحدّد النجمة لا استمرار المقطوعة.',
    notes: 'النقرات',
    notesHint: 'أربع نقرات على الأقل. اضغط على المسار لإضافة نقرة عند تلك اللحظة.',
    addNote: 'نقرة',
    timeline: 'الشريط الزمني',
    timelineHint: 'الشبكة الرأسية هي الضربات المشتقّة من bpm. النقرة على الضربة لا قريبًا منها.',
    snap: 'الالتصاق بالضربة',
    beat: 'ضربة',
    beats: (count: number) => `${count} ضربة في المقطوعة`,
    lane: 'المسار',
    time: 'اللحظة (ms)',
    generate: 'ولّد نقرة على كل ضربة',
    generateHint: 'يُنشئ نقرة على كل ضربة في المسار الأول، ثم تُعدَّل. أسرع من كتابة الأرقام.',
    clearNotes: 'امسح النقرات',
    neverFail: 'المقطوعة تكمل دائمًا',
    neverFailLocked: 'مفروض ولا يُطفأ: لا فشل في هذه اللعبة.',
    visualPulse: 'نبضة بصرية',
    visualPulseLocked: 'مفروض ولا يُطفأ: هي بديل الصوت لمن لا يسمع.',
    hapticPulse: 'نبضة لمسية',
    afterEnd: 'نقرة بعد نهاية المقطوعة.',
    outsideLane: 'نقرة في مسار غير موجود.',
    tooClose: 'نقرتان أقرب من نافذة الإصابة: لا يمكن التمييز بينهما.',
    noteCount: (count: number) => `${count} نقرة`,
  },
  en: {
    language: 'Language',
    languageHint: 'Packs in this engine are authored per language and never translated.',
    word: 'Word',
    wordHint: 'Two to five letters. Letters and slots are built from it automatically.',
    direction: 'Writing direction',
    directions: { rtl: 'Right to left', ltr: 'Left to right' } as Record<string, string>,
    slots: 'Slots',
    slotsLocked: 'Always equal to the letter count: the server refuses anything else, so there is no field to type it.',
    wordAudio: 'Word spoken',
    syllablesAudio: 'Word in syllables',
    syllablesHint: 'Like "qa — ma — r". Used by the second help rung.',
    wordImage: 'Word image',
    wordImageHint: 'One unambiguous image with no printed text: text is a translation layer.',
    showTextButton: 'Show-the-written-word button',
    showTextLocked: 'Mandatory and never switched off: it is what makes the game playable without hearing.',
    letters: 'Letters',
    lettersHint: 'Built from the word. The form is computed; the recording is what remains for the editor.',
    rebuild: 'Rebuild the letters from the word',
    letterChar: 'Letter',
    letterForm: 'Form in the word',
    forms: { isolated: 'Isolated', initial: 'Initial', medial: 'Medial', final: 'Final' } as Record<LetterPositionForm, string>,
    formComputed: 'Computed',
    formWhy: (previous: string) => `The preceding letter "${previous}" does not join to the left, so this one takes the initial form.`,
    formOverride: 'The recorded form contradicts the computed one and the server will refuse it.',
    fixForm: 'Correct the form',
    letterAudio: 'Letter sound',
    position: 'Position',
    distractors: 'Distractor letters',
    distractorsHint: 'Up to 3. Chosen for phonetic or visual closeness, never at random, and never a letter of the word.',
    addDistractor: 'Distractor letter',
    isInWord: 'This letter belongs to the word: two indistinguishable tiles, one accepted and one refused.',
    preview: 'The word as it will be shown',
    emptyWord: 'Type the word first.',
    remove: 'Delete',
    track: 'Track',
    trackHint: 'An audio asset with a documented commercial licence: publish stays blocked until the rights are recorded.',
    duration: 'Track duration (ms)',
    bpm: 'Tempo (bpm)',
    lanes: 'Lanes',
    hitWindow: 'Hit window (ms)',
    hitWindowHint: '250 to 600, never below 450 for preschool and 500 in simplified-motor mode.',
    accuracy: 'Accuracy to pass',
    accuracyHint: '0.4 to 0.8. There is no failure in this game: the value decides the star, not whether the track finishes.',
    notes: 'Notes',
    notesHint: 'At least four notes. Click a lane to add a note at that moment.',
    addNote: 'Note',
    timeline: 'Timeline',
    timelineHint: 'The vertical grid is the beats derived from bpm. Put notes on beats, not near them.',
    snap: 'Snap to the beat',
    beat: 'beat',
    beats: (count: number) => `${count} beats in the track`,
    lane: 'Lane',
    time: 'Time (ms)',
    generate: 'Add a note on every beat',
    generateHint: 'Creates one note per beat in the first lane, then adjust. Faster than typing numbers.',
    clearNotes: 'Clear the notes',
    neverFail: 'The track always finishes',
    neverFailLocked: 'Mandatory and never switched off: there is no failure in this game.',
    visualPulse: 'Visual pulse',
    visualPulseLocked: 'Mandatory and never switched off: it is the alternative to hearing.',
    hapticPulse: 'Haptic pulse',
    afterEnd: 'A note falls after the track ends.',
    outsideLane: 'A note is in a lane that does not exist.',
    tooClose: 'Two notes are closer than the hit window: they cannot be told apart.',
    noteCount: (count: number) => `${count} note(s)`,
  },
}

// ---------------------------------------------------------------------------
// word_build
// ---------------------------------------------------------------------------

/**
 * يبني الحروف من الكلمة، محافظًا على الصوت المسجَّل لكل موضع.
 *
 * الحفاظ على الصوت مقصود: تصحيح حرف واحد في كلمة لا يجوز أن يمسح تسجيلات
 * الحروف الأخرى، وإلا صار تصحيح خطأ مطبعي أغلى من تركه.
 */
function lettersFromWord(word: string, language: string, existing: WordLetter[]): WordLetter[] {
  const chars = wordChars(word)
  return chars.map((char, index) => {
    const previous = existing.find((letter) => letter.position === index + 1 && letter.char === char)
      ?? existing.find((letter) => letter.char === char)
    const form = language === 'ar' ? expectedArabicForm(chars, index) ?? undefined : previous?.form
    return {
      char,
      position: index + 1,
      form,
      audio: previous?.audio ?? '',
    }
  })
}

export function WordBuildEditor({ level, onChange }: { level: WordBuildLevel; onChange: (level: WordBuildLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const language = level.language ?? 'ar'
  const word = level.word ?? ''
  const letters = level.letters ?? []
  const distractors = level.distractors ?? []
  const chars = wordChars(word)
  const patch = (next: Partial<WordBuildLevel>) => onChange({ ...level, ...next })

  function setWord(value: string) {
    const nextLetters = lettersFromWord(value, language, letters)
    patch({
      word: value,
      letters: nextLetters,
      // الخانات تساوي عدد الحروف دائمًا. الخادم يفحص الثلاثة معًا (الكلمة،
      // الحروف، الخانات)، فربطها في مكان واحد يجعل التناقض غير ممكن.
      slots: Math.max(2, Math.min(5, nextLetters.length)),
    })
  }

  const patchLetter = (index: number, next: Partial<WordLetter>) =>
    patch({ letters: letters.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) })

  const orderedChars = useMemo(
    () => [...letters].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((letter) => letter.char),
    [letters],
  )
  const wordLetterSet = new Set(letters.map((letter) => letter.char))

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.language}</span>
          <input
            dir="ltr" value={language} placeholder="ar"
            onChange={(event) => {
              const next = event.target.value.trim()
              patch({
                language: next,
                writing_direction: next === 'ar' ? 'rtl' : level.writing_direction,
                letters: lettersFromWord(word, next, letters),
              })
            }}
          />
          <small>{text.languageHint}</small>
        </label>
        <label className="field">
          <span>{text.word}</span>
          <input
            dir={level.writing_direction === 'ltr' ? 'ltr' : 'rtl'}
            value={word}
            maxLength={12}
            onChange={(event) => setWord(event.target.value)}
          />
          <small>{text.wordHint}</small>
        </label>
        <label className="field">
          <span>{text.direction}</span>
          <select
            value={level.writing_direction ?? 'rtl'}
            disabled={language === 'ar'}
            onChange={(event) => patch({ writing_direction: event.target.value as WordBuildLevel['writing_direction'] })}
          >
            <option value="rtl">{text.directions.rtl}</option>
            <option value="ltr">{text.directions.ltr}</option>
          </select>
        </label>
      </div>

      <div className="form-grid form-grid--three">
        <div className="field">
          <span>{text.slots}</span>
          <strong dir="ltr">{level.slots ?? letters.length}</strong>
          <small>{text.slotsLocked}</small>
        </div>
        <label className="checkbox-control">
          <input type="checkbox" checked disabled readOnly />
          <span>{text.showTextButton}</span>
        </label>
        <p className="engine-note">{text.showTextLocked}</p>
      </div>

      <div className="form-grid form-grid--three">
        <AssetField label={text.wordAudio} kind="audio" value={level.word_audio} onChange={(value) => patch({ word_audio: value })} required />
        <AssetField label={text.syllablesAudio} kind="audio" value={level.word_syllables_audio} onChange={(value) => patch({ word_syllables_audio: value || undefined })} hint={text.syllablesHint} />
        <AssetField label={text.wordImage} kind="image" value={level.word_image} onChange={(value) => patch({ word_image: value })} required hint={text.wordImageHint} />
      </div>

      <EditorSection title={text.preview}>
        {!word ? <p className="data-unavailable">{text.emptyWord}</p> : (
          <p className="engine-word-preview" dir={level.writing_direction === 'ltr' ? 'ltr' : 'rtl'}>{word}</p>
        )}
      </EditorSection>

      <EditorSection
        title={`${text.letters} (${letters.length})`}
        hint={text.lettersHint}
        actions={
          <button className="button button--ghost" type="button" onClick={() => setWord(word)} disabled={!word}>
            <Icon name="refresh" size={15} />{text.rebuild}
          </button>
        }
      >
        {letters.map((letter, index) => {
          const position = letter.position ?? index + 1
          const expected = language === 'ar' ? expectedArabicForm(orderedChars, position - 1) : null
          const previous = position > 1 ? orderedChars[position - 2] ?? null : null
          const mismatch = expected !== null && letter.form !== undefined && letter.form !== expected
          return (
            <EditorCard
              key={`${letter.char}-${position}`}
              badge={<span className="engine-letter" dir="rtl">{letter.char}</span>}
              title={<>{text.position} <span dir="ltr">{position}</span></>}
              tone={mismatch ? 'warn' : 'default'}
            >
              <div className="form-grid form-grid--three">
                <label className="field">
                  <span>{text.letterChar}</span>
                  <input dir="rtl" value={letter.char} maxLength={2} onChange={(event) => {
                    const nextChar = event.target.value
                    const nextWord = chars.map((char, position2) => (position2 === index ? nextChar : char)).join('')
                    setWord(nextWord)
                  }} />
                </label>
                <div className="field">
                  <span>{text.letterForm}</span>
                  {language === 'ar' ? (
                    <>
                      <strong>{expected ? text.forms[expected] : '—'} <small>({text.formComputed})</small></strong>
                      {previous && NON_CONNECTING_AR.has(previous) && <small>{text.formWhy(previous)}</small>}
                      {mismatch && (
                        <>
                          <small className="engine-field__error">{text.formOverride}</small>
                          <button className="button button--secondary" type="button" onClick={() => patchLetter(index, { form: expected ?? undefined })}>
                            {text.fixForm}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <select value={letter.form ?? ''} onChange={(event) => patchLetter(index, { form: (event.target.value || undefined) as LetterPositionForm | undefined })}>
                      <option value="">—</option>
                      {LETTER_POSITION_FORMS.map((value) => <option value={value} key={value}>{text.forms[value]}</option>)}
                    </select>
                  )}
                </div>
                <AssetField label={text.letterAudio} kind="audio" value={letter.audio} onChange={(value) => patchLetter(index, { audio: value })} required />
              </div>
            </EditorCard>
          )
        })}
      </EditorSection>

      <EditorSection
        title={`${text.distractors} (${distractors.length}/3)`}
        hint={text.distractorsHint}
        actions={
          <button
            className="button button--ghost" type="button" disabled={distractors.length >= 3}
            onClick={() => patch({ distractors: [...distractors, { char: '', audio: '' }] })}
          ><Icon name="plus" size={15} />{text.addDistractor}</button>
        }
      >
        {distractors.map((entry, index) => {
          const clash = entry.char !== '' && wordLetterSet.has(entry.char)
          return (
            <EditorCard
              key={index}
              badge={<span className="engine-letter" dir="rtl">{entry.char || '—'}</span>}
              title={<span dir="ltr">{index + 1}</span>}
              tone={clash ? 'warn' : 'default'}
              removeLabel={text.remove}
              onRemove={() => {
                if (!confirmRemoval(locale, `${text.addDistractor} ${entry.char}`)) return
                patch({ distractors: distractors.filter((_, position) => position !== index) })
              }}
            >
              <div className="form-grid">
                <label className="field">
                  <span>{text.letterChar}</span>
                  <input
                    dir="rtl" value={entry.char} maxLength={2}
                    onChange={(event) => patch({
                      distractors: distractors.map((item, position) => (position === index ? { ...item, char: event.target.value } : item)),
                    })}
                  />
                  {clash && <small className="engine-field__error">{text.isInWord}</small>}
                </label>
                <AssetField
                  label={text.letterAudio} kind="audio" value={entry.audio} required
                  onChange={(value) => patch({
                    distractors: distractors.map((item, position) => (position === index ? { ...item, audio: value } : item)),
                  })}
                />
              </div>
            </EditorCard>
          )
        })}
      </EditorSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// rhythm_tap
// ---------------------------------------------------------------------------

const TIMELINE_HEIGHT = 34

export function RhythmTapEditor({ level, onChange }: { level: RhythmTapLevel; onChange: (level: RhythmTapLevel) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [snap, setSnap] = useState(true)
  const notes = level.notes ?? []
  const lanes = Math.max(1, Math.min(3, Number(level.lanes) || 1))
  const duration = Math.max(1, Number(level.track_duration_ms) || 30000)
  const bpm = Math.max(1, Number(level.bpm) || 90)
  const window = Number(level.hit_window_ms) || 0
  const patch = (next: Partial<RhythmTapLevel>) => onChange({ ...level, ...next })

  const beatMs = 60000 / bpm
  const beatCount = Math.floor(duration / beatMs)

  /// النقرات مرتَّبة زمنيًا دائمًا: الخادم ينبّه على غير المرتَّب، والمحرّك يقرأ
  /// المصفوفة بالترتيب.
  const sorted = useMemo(() => [...notes].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0)), [notes])

  function commit(next: RhythmNote[]) {
    patch({ notes: [...next].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0)) })
  }

  function addNoteAt(lane: number, timeMs: number) {
    const snapped = snap ? Math.round(timeMs / beatMs) * beatMs : timeMs
    const clamped = Math.max(0, Math.min(duration, Math.round(snapped)))
    commit([...notes, { time_ms: clamped, lane }])
  }

  function onLanePointerDown(event: ReactPointerEvent<HTMLDivElement>, lane: number) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    // القياس من المستطيل الفعلي: الاتجاه من اليمين لليسار يقلب موضع العنصر على
    // الشاشة، و`clientX` يبقى مقاسًا من حافة الشاشة اليسرى في الحالتين.
    const ratio = (event.clientX - rect.left) / rect.width
    addNoteAt(lane, ratio * duration)
  }

  const tooClose = useMemo(() => {
    if (!window) return false
    return sorted.some((note, index) => {
      const next = sorted[index + 1]
      return next !== undefined && Math.abs((next.time_ms ?? 0) - (note.time_ms ?? 0)) < window
    })
  }, [sorted, window])

  const afterEnd = sorted.some((note) => (note.time_ms ?? 0) > duration)
  const outsideLane = sorted.some((note) => (note.lane ?? 0) >= lanes)

  return (
    <div className="engine-editor">
      <div className="form-grid form-grid--three">
        <AssetField label={text.track} kind="audio" value={level.track} onChange={(value) => patch({ track: value })} required hint={text.trackHint} />
        <label className="field">
          <span>{text.duration}</span>
          <input type="number" dir="ltr" min="10000" max="180000" step="500" value={level.track_duration_ms ?? 30000} onChange={(event) => patch({ track_duration_ms: Number(event.target.value) })} />
        </label>
        <label className="field">
          <span>{text.bpm}</span>
          <input type="number" dir="ltr" min="60" max="140" value={level.bpm ?? 90} onChange={(event) => patch({ bpm: Number(event.target.value) })} />
          <small>{text.beats(beatCount)}</small>
        </label>
      </div>

      <div className="form-grid form-grid--three">
        <label className="field">
          <span>{text.lanes}</span>
          <select value={lanes} onChange={(event) => {
            const next = Number(event.target.value)
            // تقليل المسارات ينقل النقرات الخارجة إلى آخر مسار موجود: نقرة في
            // مسار غير موجود يرفضها الخادم، وحذفها الصامت يفقد عملًا مؤلَّفًا.
            commit(notes.map((note) => ((note.lane ?? 0) >= next ? { ...note, lane: next - 1 } : note)))
            patch({ lanes: next })
          }}>
            {[1, 2, 3].map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{text.hitWindow}</span>
          <input type="number" dir="ltr" min="250" max="600" step="10" value={level.hit_window_ms ?? 500} onChange={(event) => patch({ hit_window_ms: Number(event.target.value) })} />
          <small>{text.hitWindowHint}</small>
        </label>
        <label className="field">
          <span>{text.accuracy}</span>
          <input type="number" dir="ltr" min="0.4" max="0.8" step="0.05" value={level.accuracy_to_pass ?? 0.5} onChange={(event) => patch({ accuracy_to_pass: Number(event.target.value) })} />
          <small>{text.accuracyHint}</small>
        </label>
      </div>

      <div className="form-grid form-grid--three">
        <label className="checkbox-control">
          <input type="checkbox" checked disabled readOnly />
          <span>{text.neverFail}</span>
        </label>
        <label className="checkbox-control">
          <input type="checkbox" checked disabled readOnly />
          <span>{text.visualPulse}</span>
        </label>
        <label className="checkbox-control">
          <input type="checkbox" checked={level.haptic_pulse !== false} onChange={(event) => patch({ haptic_pulse: event.target.checked })} />
          <span>{text.hapticPulse}</span>
        </label>
      </div>
      <p className="engine-note">{text.neverFailLocked} {text.visualPulseLocked}</p>

      <EditorSection
        title={text.timeline}
        hint={text.timelineHint}
        actions={
          <>
            <label className="checkbox-control">
              <input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} />
              <span>{text.snap}</span>
            </label>
            <button
              className="button button--secondary" type="button"
              onClick={() => commit(Array.from({ length: beatCount }, (_, index) => ({ time_ms: Math.round(index * beatMs), lane: 0 })))}
            ><Icon name="sparkles" size={15} />{text.generate}</button>
            <button
              className="button button--ghost" type="button" disabled={!notes.length}
              onClick={() => { if (confirmRemoval(locale, text.notes)) commit([]) }}
            ><Icon name="archive" size={15} />{text.clearNotes}</button>
          </>
        }
      >
        <p className="engine-note">{text.generateHint}</p>
        <div className="engine-timeline" role="group" aria-label={text.timeline}>
          {Array.from({ length: lanes }, (_, lane) => (
            <div className="engine-timeline__lane" key={lane}>
              <span className="engine-timeline__label">{text.lane} {lane + 1}</span>
              <div
                className="engine-timeline__track"
                style={{ height: TIMELINE_HEIGHT }}
                role="button"
                tabIndex={0}
                aria-label={`${text.addNote} · ${text.lane} ${lane + 1}`}
                onPointerDown={(event) => onLanePointerDown(event, lane)}
                onKeyDown={(event) => {
                  // بديل لوحة المفاتيح للنقر: يضيف نقرة على أوّل ضربة خالية،
                  // فالمحرّر لا يحتاج فأرة لبناء مستوى.
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  const taken = new Set(notes.filter((note) => note.lane === lane).map((note) => note.time_ms))
                  for (let beat = 0; beat < beatCount; beat += 1) {
                    const time = Math.round(beat * beatMs)
                    if (!taken.has(time)) { addNoteAt(lane, time); return }
                  }
                }}
              >
                {Array.from({ length: beatCount + 1 }, (_, beat) => (
                  <span
                    className={beat % 4 === 0 ? 'engine-timeline__beat engine-timeline__beat--bar' : 'engine-timeline__beat'}
                    style={{ insetInlineStart: `${((beat * beatMs) / duration) * 100}%` }}
                    key={beat}
                    aria-hidden="true"
                  />
                ))}
                {sorted.filter((note) => note.lane === lane).map((note, index) => (
                  <span
                    className="engine-timeline__note"
                    style={{ insetInlineStart: `${Math.min(100, ((note.time_ms ?? 0) / duration) * 100)}%` }}
                    key={`${note.time_ms}-${index}`}
                    title={`${note.time_ms}ms`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {afterEnd && <p className="inline-alert inline-alert--error">{text.afterEnd}</p>}
        {outsideLane && <p className="inline-alert inline-alert--error">{text.outsideLane}</p>}
        {tooClose && <p className="inline-alert inline-alert--info">{text.tooClose}</p>}
      </EditorSection>

      <EditorSection
        title={`${text.notes} — ${text.noteCount(notes.length)}`}
        hint={text.notesHint}
        actions={
          <button className="button button--secondary" type="button" onClick={() => addNoteAt(0, sorted.length ? (sorted[sorted.length - 1]?.time_ms ?? 0) + beatMs : 0)}>
            <Icon name="plus" size={15} />{text.addNote}
          </button>
        }
      >
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>{text.time}</th><th>{text.lane}</th><th>{text.beat}</th><th /></tr>
            </thead>
            <tbody>
              {sorted.map((note, index) => (
                <tr key={`${note.time_ms}-${note.lane}-${index}`}>
                  <td dir="ltr">{index + 1}</td>
                  <td>
                    <input
                      type="number" dir="ltr" min="0" max={duration} step="10" aria-label={`${text.time} ${index + 1}`}
                      value={note.time_ms ?? 0}
                      onChange={(event) => commit(sorted.map((entry, position) => (position === index ? { ...entry, time_ms: Number(event.target.value) } : entry)))}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`${text.lane} ${index + 1}`}
                      value={note.lane ?? 0}
                      onChange={(event) => commit(sorted.map((entry, position) => (position === index ? { ...entry, lane: Number(event.target.value) } : entry)))}
                    >
                      {Array.from({ length: lanes }, (_, lane) => <option value={lane} key={lane}>{lane + 1}</option>)}
                    </select>
                  </td>
                  <td dir="ltr">{(((note.time_ms ?? 0) / beatMs) + 1).toFixed(2)}</td>
                  <td>
                    <button
                      className="icon-button icon-button--small icon-button--danger" type="button" title={text.remove}
                      aria-label={`${text.remove} ${index + 1}`}
                      onClick={() => commit(sorted.filter((_, position) => position !== index))}
                    ><Icon name="close" size={13} /></button>
                  </td>
                </tr>
              ))}
              {!sorted.length && <tr><td colSpan={5} className="data-unavailable">—</td></tr>}
            </tbody>
          </table>
        </div>
      </EditorSection>
    </div>
  )
}
