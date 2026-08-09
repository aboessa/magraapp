import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Ico } from '../icons'

/** m:ss بأرقام لاتينية ومعزولة اتجاهيًا حتى لا تُقلب داخل نص عربي */
function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  return `\u2066${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}\u2069`
}

type AudioPlayerProps = {
  src: string
  /** قمم مقيسة من الملف نفسه، لا أرقام تزيينية */
  waveform: number[]
  /** المدة المعروفة مسبقًا حتى يظهر شيء قبل تحميل البيانات الوصفية */
  durationSeconds: number
  /** اسم يوصف المقطع لقارئ الشاشة */
  label: string
  /** نص ثابت يُعرض قبل بدء التشغيل */
  idleText: string
  /** بادئة تظهر دائمًا قبل الوقت، مثل رقم الصفحة */
  prefix?: string
}

/**
 * مشغّل صوت حقيقي: لا يُنزّل الملف إلا عند الضغط، والموجة تعرض
 * تقدّم التشغيل الفعلي وتصلح للانتقال بالنقر، ويتوقف تلقائيًا
 * إذا خرج من الشاشة حتى لا يستمر الصوت بعيدًا عن الزائر.
 */
export function AudioPlayer({
  src, waveform, durationSeconds, label, idleText, prefix,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationSeconds)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  // تغيير المصدر يعني مقطعًا آخر، فنعيد الحالة من الصفر
  useEffect(() => {
    const audio = audioRef.current
    setPlaying(false)
    setCurrentTime(0)
    setDuration(durationSeconds)
    setLoading(false)
    setFailed(false)
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
  }, [src, durationSeconds])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
    }
    const onEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0
    }
    const onPlay = () => { setPlaying(true); setLoading(false) }
    const onPause = () => setPlaying(false)
    const onWaiting = () => setLoading(true)
    const onPlaying = () => setLoading(false)
    const onError = () => { setFailed(true); setPlaying(false); setLoading(false) }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('error', onError)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    const wrap = wrapRef.current
    if (!audio || !wrap || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && !audio.paused) audio.pause()
      })
    }, { threshold: 0.1 })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || failed) return
    if (audio.paused) {
      setLoading(true)
      audio.play().catch(() => { setFailed(true); setLoading(false) })
    } else {
      audio.pause()
    }
  }

  const progress = duration > 0 ? currentTime / duration : 0
  const activeBars = Math.round(progress * waveform.length)
  const status = playing || currentTime > 0
    ? `${formatTime(currentTime)} / ${formatTime(duration)}`
    : idleText

  return (
    <div className="mj-reader-audio" ref={wrapRef}>
      <audio ref={audioRef} src={src} preload="none" />

      <button
        className="mj-play"
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-label={playing ? `إيقاف ${label}` : `تشغيل ${label}`}
      >
        {loading && !playing
          ? <span className="mj-play-spin" aria-hidden="true" />
          : <Ico name={playing ? 'pause' : 'play'} solid />}
      </button>

      <button
        className="mj-wave"
        type="button"
        aria-label={`الانتقال داخل ${label}`}
        disabled={failed}
        onClick={(event) => {
          const audio = audioRef.current
          if (!audio || !Number.isFinite(duration)) return
          const box = event.currentTarget.getBoundingClientRect()
          // القسم بالعربية RTL، فبداية المقطع عند الحافة اليمنى
          const ratio = (box.right - event.clientX) / box.width
          audio.currentTime = Math.max(0, Math.min(duration, ratio * duration))
          setCurrentTime(audio.currentTime)
        }}
      >
        {waveform.map((height, index) => (
          <i
            key={`${height}-${index}`}
            className={index < activeBars ? 'is-played' : undefined}
            style={{ '--mj-h': `${height}%` } as CSSProperties}
          />
        ))}
      </button>

      <small>
        {failed ? 'المقطع غير متاح حاليًا' : prefix ? `${prefix} · ${status}` : status}
      </small>
    </div>
  )
}
