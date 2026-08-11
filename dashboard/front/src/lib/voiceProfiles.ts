export type VoiceProfile = {
  id: string
  name_ar: string
  name_en: string
  language: string
  role: string
  character?: string
  series?: string
  status: 'approved' | 'testing' | 'draft'
  providerVoice: string
  description: string
}

export const VOICE_PROFILES: VoiceProfile[] = [
  { id: 'vp-story-calm', name_ar: 'راوي القصص الهادئ', name_en: 'Calm Storyteller', language: 'ar', role: 'narrator', status: 'approved', providerVoice: 'Kore', description: 'Warm gentle bedtime, 3-5' },
  { id: 'vp-mazen', name_ar: 'مازن', name_en: 'Mazen', language: 'ar', role: 'character', character: 'مازن', series: 'مازن وثعلوب', status: 'approved', providerVoice: 'Kore', description: 'Character voice' },
  { id: 'vp-edu', name_ar: 'المعلم', name_en: 'Teacher', language: 'ar', role: 'educator', status: 'approved', providerVoice: 'Kore', description: 'Educational explanation' },
  { id: 'vp-en-narrator', name_ar: 'English Narrator', name_en: 'English Narrator', language: 'en', role: 'narrator', status: 'testing', providerVoice: 'Kore', description: 'EN story' },
]

export function profileFor(language: string, character?: string): VoiceProfile | undefined {
  if (character) return VOICE_PROFILES.find(v => v.character === character)
  return VOICE_PROFILES.find(v => v.language === language && v.status === 'approved')
}
