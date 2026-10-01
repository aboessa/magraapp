import { useState } from 'react'
import { Icon } from '../components/Icon'
import { api } from '../lib/api'
import { usePreferences } from '../context/preferences'
import type { MediaIngestMatch } from '../types/api'

export function MediaIngestPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [files, setFiles] = useState<File[]>([])
  const [matching, setMatching] = useState(false)
  const [matches, setMatches] = useState<MediaIngestMatch[]>([])
  const [applying, setApplying] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')

  const handleFileDrop = async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return
    const fileArray = Array.from(newFiles)
    setFiles(fileArray)
    setError('')
    setSuccessMessage('')
    setMatching(true)

    try {
      const filenames = fileArray.map((f) => f.name)
      const res = await api.mediaIngestMatch(filenames)
      if (res.data?.matches) {
        setMatches(res.data.matches)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ar ? 'فشلت مطابقة الملفات' : 'File matching failed'))
    } finally {
      setMatching(false)
    }
  }

  const handleApply = async () => {
    const validMatches = matches.filter((m) => m.matched_episode_id !== null)
    if (validMatches.length === 0) {
      setError(ar ? 'لا توجد ملفات متطابقة مع حلقات معتمدة' : 'No matched items found')
      return
    }

    setApplying(true)
    setError('')
    try {
      const updates = validMatches.map((m) => ({
        episode_id: m.matched_episode_id!,
        field: m.detected_field === 'thumbnail_url' ? 'thumbnail_url' as const : 'video_url' as const,
        value: `https://cdn.majarra.app/media/ingest/${encodeURIComponent(m.filename)}`,
      }))

      const res = await api.mediaIngestApply(updates)
      setSuccessMessage(
        ar
          ? `✅ تم ربط وتحديث ${res.data?.updated ?? updates.length} ملف بنجاح في قاعدة بيانات الحلقات!`
          : `✅ Successfully linked ${res.data?.updated ?? updates.length} files!`
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ar ? 'تعذر تطبيق الربط' : 'Failed to apply mapping'))
    } finally {
      setApplying(false)
    }
  }

  const handleClear = () => {
    setFiles([])
    setMatches([])
    setError('')
    setSuccessMessage('')
  }

  return (
    <div className="admin-page-container space-y-6 pb-12" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>📥</span>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {ar ? 'مركز استيراد ورفع المحتوى الجماعي (Bulk Media Ingest)' : 'Bulk Media Ingestion & Auto-Matcher'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1" style={{ color: 'var(--text-secondary, #6b7280)', marginTop: '4px' }}>
            {ar
              ? 'رفع مجلدات ومواسم كاملة بالسحب والإفلات، مع مطابقة ذكية تلقائية لأسماء الحلقات والأغلفة والترجمات'
              : 'Drag & drop full seasons of video and assets with automatic episode pattern recognition'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {files.length > 0 && (
            <button
              onClick={handleClear}
              style={{
                padding: '10px 16px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {ar ? 'مسح القائمة' : 'Clear All'}
            </button>
          )}

          {matches.length > 0 && (
            <button
              onClick={handleApply}
              disabled={applying}
              style={{
                padding: '10px 24px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                cursor: applying ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Icon name="check" size={18} />
              {applying ? (ar ? 'جاري الربط...' : 'Applying...') : (ar ? 'تأكيد وربط الملفات المكتشفة' : 'Apply Mapping')}
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div style={{ padding: '14px 18px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#166534', fontWeight: 'bold' }}>
          {successMessage}
        </div>
      )}

      {error && (
        <div style={{ padding: '14px 18px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleFileDrop(e.dataTransfer.files)
        }}
        style={{
          border: '2px dashed #93c5fd',
          borderRadius: '16px',
          background: 'var(--card-bg, #ffffff)',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease',
        }}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.multiple = true
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement
            handleFileDrop(target.files)
          }
          input.click()
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📁</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary, #111827)' }}>
          {ar ? 'اسحب وأفلت مجلدات ومواسم الحلقات هنا' : 'Drag & drop episode files or click to browse'}
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>
          {ar
            ? 'يدعم ملفات الفيديو (MP4, M3U8, WebM)، الأغلفة (WebP, JPG, PNG)، وملفات الترجمة (VTT, SRT)'
            : 'Supports video files (MP4, M3U8), posters (WebP, JPG), and subtitles (VTT, SRT)'}
        </div>
        <div style={{ marginTop: '16px' }}>
          <span style={{ display: 'inline-block', padding: '8px 18px', borderRadius: '20px', background: '#eff6ff', color: '#1e40af', fontSize: '13px', fontWeight: 'bold' }}>
            {ar ? 'تصفح الملفات من جهازك' : 'Browse Local Files'}
          </span>
        </div>
      </div>

      {/* Matching Results Table */}
      {matching && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
          <span style={{ fontSize: '24px' }}>⏳</span>
          <div style={{ marginTop: '8px', fontWeight: '600' }}>
            {ar ? 'جاري فحص وتطابق أسماء الملفات مع حلقات قاعدة البيانات...' : 'Analyzing and matching file patterns...'}
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <div style={{ padding: '24px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔍</span> {ar ? 'نتائج المطابقة الذكية للدفعة' : 'Batch Auto-Matching Results'}
            </h2>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              {ar
                ? `تم التعرف على ${matches.filter((m) => m.matched_episode_id !== null).length} من أصل ${matches.length} ملف`
                : `Matched ${matches.filter((m) => m.matched_episode_id !== null).length} of ${matches.length} files`}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: ar ? 'right' : 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontSize: '12px' }}>
                  <th style={{ padding: '12px' }}>{ar ? 'اسم الملف' : 'Filename'}</th>
                  <th style={{ padding: '12px' }}>{ar ? 'نوع الأصل' : 'Asset Field'}</th>
                  <th style={{ padding: '12px' }}>{ar ? 'رقم الحلقة' : 'Detected Ep'}</th>
                  <th style={{ padding: '12px' }}>{ar ? 'الحلقة المستهدفة' : 'Matched Episode'}</th>
                  <th style={{ padding: '12px' }}>{ar ? 'دقة التطابق' : 'Confidence'}</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '600', color: '#1e293b' }}>
                      {item.filename}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: item.detected_field === 'thumbnail_url' ? '#fef3c7' : '#e0e7ff',
                          color: item.detected_field === 'thumbnail_url' ? '#b45309' : '#3730a3',
                        }}
                      >
                        {item.detected_field === 'thumbnail_url'
                          ? (ar ? '🖼️ غلاف مصغر' : 'Thumbnail')
                          : (ar ? '🎬 فيديو' : 'Video')}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>
                      {item.parsed_episode_number !== null
                        ? (ar ? `حلقة ${item.parsed_episode_number}` : `Ep ${item.parsed_episode_number}`)
                        : '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {item.episode_title ? (
                        <div>
                          <div style={{ fontWeight: '600' }}>{item.episode_title}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>{item.series_title}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                          {ar ? 'لم يتم العثور على حلقة مطابقة' : 'No match'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: item.confidence === 'high' ? '#dcfce7' : '#f3f4f6',
                          color: item.confidence === 'high' ? '#15803d' : '#6b7280',
                        }}
                      >
                        {item.confidence === 'high' ? (ar ? 'مؤكد 100% ✓' : 'High') : (ar ? 'غير مؤكد' : 'Unmatched')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
