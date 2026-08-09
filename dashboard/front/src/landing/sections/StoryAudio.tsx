import { useLandingLocale } from '../i18n'
import { STORY_CLIPS } from '../structure'
import { useCopy } from '../useContent'
import { AudioPlayer } from './AudioPlayer'

/** بطاقة القارئ في قسم كوكب القصص تعرض المقطع بلغة الزائر */
export function StoryAudio() {
  const { locale } = useLandingLocale()
  const text = useCopy().stories
  const clip = STORY_CLIPS[locale]

  return (
    <AudioPlayer
      src={clip.src}
      waveform={clip.waveform}
      durationSeconds={clip.durationSeconds}
      label={text.audioLabel}
      idleText={text.audioVoice}
      prefix={text.audioPage}
    />
  )
}
