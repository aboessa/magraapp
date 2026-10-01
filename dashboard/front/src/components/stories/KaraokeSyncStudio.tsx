import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { api } from '../../lib/api'
import { usePreferences } from '../../context/preferences'

export interface TimingCue {
  word: string
  start_ms: number
  end_ms: number
  [key: string]: unknown
}

interface KaraokeSyncStudioProps {
  pageId: string
  language: string
  audioAssetId: string
  bodyText: string
  initialCues: TimingCue[]
  onSaveCues: (cues: TimingCue[]) => Promise<void>
  canEdit: boolean
}

export function KaraokeSyncStudio({
  pageId: _pageId,
  language,
  audioAssetId,
  bodyText,
  initialCues,
  onSaveCues,
  canEdit,
}: KaraokeSyncStudioProps) {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const isRtl = language === 'ar'

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>('')
  const [audioLoading, setAudioLoading] = useState<boolean>(true)
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackRate, setPlaybackRate] = useState<number>(1)

  // Tokenize text into words
  const words = useMemo(() => {
    return (bodyText || '').trim().split(/\s+/).filter(Boolean)
  }, [bodyText])

  // Cues state
  const [cues, setCues] = useState<TimingCue[]>(() => {
    if (initialCues && initialCues.length > 0) return initialCues
    // Initialize blank cues matching words
    return words.map((w) => ({ word: w, start_ms: 0, end_ms: 0 }))
  })

  // Sync cues with words if text changed and cues are empty
  useEffect(() => {
    if (initialCues && initialCues.length > 0) {
      setCues(initialCues)
    } else {
      setCues(words.map((w) => ({ word: w, start_ms: 0, end_ms: 0 })))
    }
  }, [initialCues, words])

  // Studio Mode: 'preview' (karaoke player) | 'tap' (live tap sync) | 'adjust' (fine tune)
  const [studioMode, setStudioMode] = useState<'preview' | 'tap' | 'adjust'>('preview')
  const [recordingWordIdx, setRecordingWordIdx] = useState<number>(-1)
  const [saving, setSaving] = useState<boolean>(false)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')

  // Load Audio Blob
  useEffect(() => {
    if (!audioAssetId) {
      setAudioUrl('')
      setAudioLoading(false)
      return
    }

    let active = true
    let blobUrl = ''
    setAudioLoading(true)

    void api.assetBlob(audioAssetId)
      .then((blob) => {
        if (!active) return
        blobUrl = URL.createObjectURL(blob)
        setAudioUrl(blobUrl)
        setAudioLoading(false)
      })
      .catch(() => {
        if (!active) return
        setAudioLoading(false)
      })

    return () => {
      active = false
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [audioAssetId])

  // Audio time listener
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    let animId: number
    const updateProgress = () => {
      if (audio && !audio.paused) {
        setCurrentTimeMs(Math.round(audio.currentTime * 1000))
        animId = requestAnimationFrame(updateProgress)
      }
    }

    const onPlay = () => {
      setIsPlaying(true)
      animId = requestAnimationFrame(updateProgress)
    }
    const onPause = () => {
      setIsPlaying(false)
      cancelAnimationFrame(animId)
      if (audio) setCurrentTimeMs(Math.round(audio.currentTime * 1000))
    }
    const onLoadedMetadata = () => {
      setAudioDuration(Math.round(audio.duration * 1000))
    }
    const onEnded = () => {
      setIsPlaying(false)
      cancelAnimationFrame(animId)
      if (studioMode === 'tap') {
        setRecordingWordIdx(-1)
      }
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      cancelAnimationFrame(animId)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [studioMode])

  // Play / Pause toggle
  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
    } else {
      audio.pause()
    }
  }

  // Seek
  const handleSeek = (ms: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = ms / 1000
    setCurrentTimeMs(ms)
  }

  // Playback Rate
  const changeRate = (rate: number) => {
    setPlaybackRate(rate)
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }

  // Live Tap Sync Handler
  const handleNextWordTap = useCallback(() => {
    const nowMs = currentTimeMs
    setRecordingWordIdx((prev) => {
      const next = prev + 1
      if (next >= words.length) {
        // finished
        if (audioRef.current) audioRef.current.pause()
        return -1
      }

      setCues((currentCues) => {
        const copy = [...currentCues]
        if (prev >= 0 && copy[prev]) {
          copy[prev] = { ...copy[prev], end_ms: Math.max(copy[prev].start_ms + 100, nowMs) }
        }
        if (copy[next]) {
          copy[next] = { ...copy[next], start_ms: nowMs, end_ms: nowMs + 400 }
        }
        return copy
      })

      return next
    })
  }, [currentTimeMs, words.length])

  // Spacebar hotkey for Tap Sync
  useEffect(() => {
    if (studioMode !== 'tap' || recordingWordIdx === -1) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleNextWordTap()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [studioMode, recordingWordIdx, handleNextWordTap])

  // Start live tap recording
  const startTapRecording = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    setCurrentTimeMs(0)
    setRecordingWordIdx(0)
    setCues(words.map((w) => ({ word: w, start_ms: 0, end_ms: 0 })))
    void audio.play()
  }

  // Auto-distribute cues evenly
  const autoDistribute = () => {
    const duration = audioDuration || 5000
    if (words.length === 0) return
    const slice = Math.floor(duration / words.length)
    const distributed = words.map((w, i) => ({
      word: w,
      start_ms: i * slice,
      end_ms: (i + 1) * slice - 50,
    }))
    setCues(distributed)
  }

  // Save cues
  const handleSave = async () => {
    if (!canEdit || saving) return
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      await onSaveCues(cues)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save cues')
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`
  }

  // Check if a word is currently active in playback
  const isWordActive = (cue: TimingCue) => {
    if (!isPlaying) return false
    return currentTimeMs >= cue.start_ms && currentTimeMs <= cue.end_ms
  }

  if (audioLoading) {
    return <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)' }}>{ar ? 'جارٍ تحميل الصوت...' : 'Loading audio...'}</div>
  }

  if (!audioUrl) {
    return null
  }

  return (
    <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2, rgba(0,0,0,0.03))', borderRadius: 10, border: '1px solid var(--border)' }}>
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🎤</span>
          <span>{ar ? 'استوديو مزامنة الكاريوكي (قراءة متزامنة)' : 'Karaoke Read-Along Studio'}</span>
        </strong>

        <div style={{ display: 'inline-flex', background: 'var(--bg-subtle, rgba(0,0,0,0.06))', padding: 2, borderRadius: 6 }}>
          <button
            type="button"
            className={`button button--small ${studioMode === 'preview' ? 'button--secondary' : 'button--ghost'}`}
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setStudioMode('preview')}
          >
            ▶ {ar ? 'معاينة' : 'Preview'}
          </button>
          <button
            type="button"
            className={`button button--small ${studioMode === 'tap' ? 'button--secondary' : 'button--ghost'}`}
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setStudioMode('tap')}
          >
            ⏱ {ar ? 'تسجيل باللمس' : 'Tap Sync'}
          </button>
          <button
            type="button"
            className={`button button--small ${studioMode === 'adjust' ? 'button--secondary' : 'button--ghost'}`}
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setStudioMode('adjust')}
          >
            ✏️ {ar ? 'محرر دقيق' : 'Adjust'}
          </button>
        </div>
      </div>

      {/* Player Controls Strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface, #fff)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
        <button
          type="button"
          className="button button--primary button--small"
          style={{ width: 34, height: 34, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <span style={{ fontSize: 11, fontFamily: 'monospace', minWidth: 64 }} dir="ltr">
          {formatTime(currentTimeMs)}
        </span>

        <input
          type="range"
          min={0}
          max={audioDuration || 1000}
          value={currentTimeMs}
          onChange={(e) => handleSeek(Number(e.target.value))}
          style={{ flex: 1, cursor: 'pointer' }}
        />

        <span style={{ fontSize: 11, fontFamily: 'monospace', minWidth: 50, color: 'var(--muted)' }} dir="ltr">
          {formatTime(audioDuration)}
        </span>

        {/* Speed toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[0.75, 1, 1.25].map((rate) => (
            <button
              key={rate}
              type="button"
              className={`button button--small ${playbackRate === rate ? 'button--secondary' : 'button--ghost'}`}
              style={{ padding: '2px 6px', fontSize: 10 }}
              onClick={() => changeRate(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Mode A: Live Tap Sync Controls */}
      {studioMode === 'tap' && (
        <div style={{ padding: 10, background: 'rgba(59, 130, 246, 0.08)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ fontSize: 12, color: '#2563eb', display: 'block' }}>
                {ar ? 'وضع التسجيل باللمس المباشر' : 'Live Tap-to-Sync Mode'}
              </strong>
              <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                {ar
                  ? 'اضغط زر "بدء التسجيل"، ثم انقر Spacebar أو زر "الكلمة التالية" عند نطق كل كلمة.'
                  : 'Click Start, then press Spacebar or Next Word as each word is spoken.'}
              </small>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {recordingWordIdx === -1 ? (
                <button
                  type="button"
                  className="button button--primary button--small"
                  onClick={startTapRecording}
                  disabled={!canEdit}
                >
                  🔴 {ar ? 'بدء التسجيل من البداية' : 'Start Recording'}
                </button>
              ) : (
                <button
                  type="button"
                  className="button button--primary button--small"
                  style={{ background: '#10b981', borderColor: '#10b981', padding: '6px 14px', fontSize: 13, fontWeight: 700 }}
                  onClick={handleNextWordTap}
                >
                  ⚡ {ar ? 'الكلمة التالية (Space)' : 'Next Word (Space)'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Karaoke Word Display Stage */}
      <div
        style={{
          padding: 14,
          borderRadius: 8,
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border)',
          lineHeight: 2,
          direction: isRtl ? 'rtl' : 'ltr',
          textAlign: isRtl ? 'right' : 'left',
          maxHeight: 220,
          overflowY: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 8px',
        }}
      >
        {cues.map((cue, idx) => {
          const active = isWordActive(cue)
          const isRecordingCurrent = studioMode === 'tap' && recordingWordIdx === idx
          const hasTime = cue.start_ms > 0 || cue.end_ms > 0

          let background = 'transparent'
          let color = 'inherit'
          let transform = 'scale(1)'
          let border = '1px solid transparent'

          if (active) {
            background = '#fef3c7'
            color = '#b45309'
            transform = 'scale(1.12)'
            border = '1px solid #f59e0b'
          } else if (isRecordingCurrent) {
            background = '#dbeafe'
            color = '#1d4ed8'
            transform = 'scale(1.12)'
            border = '1px solid #3b82f6'
          } else if (hasTime) {
            background = 'rgba(16, 185, 129, 0.08)'
            border = '1px solid rgba(16, 185, 129, 0.2)'
          }

          return (
            <span
              key={idx}
              onClick={() => {
                if (cue.start_ms > 0) handleSeek(cue.start_ms)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: active || isRecordingCurrent ? 800 : 500,
                background,
                color,
                border,
                transform,
                transition: 'all 0.15s ease',
                cursor: cue.start_ms > 0 ? 'pointer' : 'default',
              }}
              title={cue.start_ms > 0 ? `${formatTime(cue.start_ms)} → ${formatTime(cue.end_ms)}` : ''}
            >
              {cue.word}
            </span>
          )
        })}
      </div>

      {/* Mode C: Fine-tune Adjuster Table */}
      {studioMode === 'adjust' && (
        <div style={{ marginTop: 10, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 6, background: 'var(--surface, #fff)' }}>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                <th style={{ textAlign: isRtl ? 'right' : 'left', padding: 4 }}>#</th>
                <th style={{ textAlign: isRtl ? 'right' : 'left', padding: 4 }}>{ar ? 'الكلمة' : 'Word'}</th>
                <th style={{ textAlign: 'center', padding: 4 }}>{ar ? 'البداية (ms)' : 'Start (ms)'}</th>
                <th style={{ textAlign: 'center', padding: 4 }}>{ar ? 'النهاية (ms)' : 'End (ms)'}</th>
                <th style={{ textAlign: 'center', padding: 4 }}>{ar ? 'سماع' : 'Play'}</th>
              </tr>
            </thead>
            <tbody>
              {cues.map((cue, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: 4, color: 'var(--muted)' }}>{idx + 1}</td>
                  <td style={{ padding: 4, fontWeight: 600 }}>{cue.word}</td>
                  <td style={{ padding: 4, textAlign: 'center' }}>
                    <input
                      type="number"
                      dir="ltr"
                      value={cue.start_ms}
                      disabled={!canEdit}
                      style={{ width: 65, fontSize: 11, padding: '2px 4px', textAlign: 'center', borderRadius: 4, border: '1px solid var(--border)' }}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setCues((prev) => {
                          const copy = [...prev]
                          copy[idx] = { ...copy[idx], start_ms: val }
                          return copy
                        })
                      }}
                    />
                  </td>
                  <td style={{ padding: 4, textAlign: 'center' }}>
                    <input
                      type="number"
                      dir="ltr"
                      value={cue.end_ms}
                      disabled={!canEdit}
                      style={{ width: 65, fontSize: 11, padding: '2px 4px', textAlign: 'center', borderRadius: 4, border: '1px solid var(--border)' }}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setCues((prev) => {
                          const copy = [...prev]
                          copy[idx] = { ...copy[idx], end_ms: val }
                          return copy
                        })
                      }}
                    />
                  </td>
                  <td style={{ padding: 4, textAlign: 'center' }}>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={() => handleSeek(cue.start_ms)}
                    >
                      ▶
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={autoDistribute}
          disabled={!canEdit}
          title={ar ? 'توزيع الكلمات بالتساوي كبداية مبدئية' : 'Evenly space words across audio duration'}
        >
          ⚡ {ar ? 'توزيع المدد تلقائيًا' : 'Auto-Distribute'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saveSuccess && (
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
              ✓ {ar ? 'تم حفظ التوقيت بنجاح!' : 'Cues saved successfully!'}
            </span>
          )}
          {saveError && (
            <span style={{ fontSize: 11, color: '#ef4444' }}>
              {saveError}
            </span>
          )}

          <button
            type="button"
            className="button button--primary button--small"
            onClick={handleSave}
            disabled={!canEdit || saving}
          >
            <Icon name="check" size={13} />
            <span>{saving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ توقيت الكاريوكي' : 'Save Karaoke Cues')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
