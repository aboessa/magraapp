import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/PageState'
import { api } from '../lib/api'
import { usePreferences } from '../context/preferences'
import type { GamificationBadge, GamificationConfig } from '../types/api'

const DEFAULT_CONFIG: GamificationConfig = {
  streaks: {
    enabled: true,
    max_multiplier: 3.0,
    daily_rewards: [
      { day: 1, stars: 10, bonus: null },
      { day: 2, stars: 15, bonus: null },
      { day: 3, stars: 25, bonus: 'double_stars_30m' },
      { day: 4, stars: 30, bonus: null },
      { day: 5, stars: 40, bonus: 'special_avatar_frame' },
      { day: 6, stars: 50, bonus: null },
      { day: 7, stars: 100, bonus: 'super_cosmic_chest' },
    ],
  },
  economy: {
    stars_per_episode: 20,
    stars_per_game_completed: 15,
    stars_per_story_read: 25,
    stars_per_perfect_drawing: 30,
    stars_per_quiz_passed: 40,
    daily_cap: 500,
  },
  badges: [
    { id: 'b_explorer', code: 'space_explorer', name_ar: 'مستكشف الفضاء', name_en: 'Space Explorer', icon: '🚀', category: 'exploration', unlock_condition: 'visit_all_planets', stars_reward: 100 },
    { id: 'b_bookworm', code: 'story_master', name_ar: 'حكيم القصص', name_en: 'Story Master', icon: '📚', category: 'reading', unlock_condition: 'read_10_stories', stars_reward: 150 },
    { id: 'b_artist', code: 'creative_artist', name_ar: 'فنان مجرة', name_en: 'Majarra Artist', icon: '🎨', category: 'creativity', unlock_condition: 'complete_15_drawings', stars_reward: 200 },
    { id: 'b_streak7', code: 'streak_week', name_ar: 'بطل الاستمرار', name_en: 'Weekly Champion', icon: '🔥', category: 'consistency', unlock_condition: 'login_7_days_streak', stars_reward: 250 },
    { id: 'b_scholar', code: 'quiz_genius', name_ar: 'عبقري الأسئلة', name_en: 'Quiz Genius', icon: '🧠', category: 'learning', unlock_condition: 'pass_5_quizzes_perfect', stars_reward: 300 },
  ],
  parent_controls: {
    require_parent_approval_for_redemptions: true,
    weekly_screen_time_milestone_reward: true,
    allow_custom_parent_rewards: true,
  },
}

export function GamificationAdminPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'

  const [config, setConfig] = useState<GamificationConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')

  // Badge Modal State
  const [badgeModalOpen, setBadgeModalOpen] = useState(false)
  const [editingBadgeIndex, setEditingBadgeIndex] = useState<number | null>(null)
  const [badgeForm, setBadgeForm] = useState<GamificationBadge>({
    id: '',
    code: '',
    name_ar: '',
    name_en: '',
    icon: '🌟',
    category: 'exploration',
    unlock_condition: '',
    stars_reward: 100,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.gamificationConfig()
      if (res.data) {
        setConfig(res.data)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ar ? 'تعذر تحميل إعدادات التحفيز' : 'Failed to load gamification settings'))
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaveSuccess(false)
    try {
      await api.updateGamificationConfig(config)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ar ? 'تعذر حفظ الإعدادات' : 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  const updateStreakDay = (index: number, stars: number, bonus: string | null) => {
    setConfig(prev => {
      const updatedDays = [...prev.streaks.daily_rewards]
      updatedDays[index] = { ...updatedDays[index], stars, bonus: bonus || null }
      return {
        ...prev,
        streaks: { ...prev.streaks, daily_rewards: updatedDays },
      }
    })
  }

  const openAddBadge = () => {
    setEditingBadgeIndex(null)
    setBadgeForm({
      id: `b_${Date.now()}`,
      code: '',
      name_ar: '',
      name_en: '',
      icon: '🏆',
      category: 'exploration',
      unlock_condition: '',
      stars_reward: 100,
    })
    setBadgeModalOpen(true)
  }

  const openEditBadge = (badge: GamificationBadge, index: number) => {
    setEditingBadgeIndex(index)
    setBadgeForm({ ...badge })
    setBadgeModalOpen(true)
  }

  const handleSaveBadge = (e: React.FormEvent) => {
    e.preventDefault()
    if (!badgeForm.name_ar.trim() || !badgeForm.code.trim()) return

    setConfig(prev => {
      const badges = [...prev.badges]
      if (editingBadgeIndex !== null) {
        badges[editingBadgeIndex] = badgeForm
      } else {
        badges.push(badgeForm)
      }
      return { ...prev, badges }
    })
    setBadgeModalOpen(false)
  }

  const handleDeleteBadge = (index: number) => {
    if (!window.confirm(ar ? 'هل تريد حذف هذا الوسام؟' : 'Delete this badge?')) return
    setConfig(prev => ({
      ...prev,
      badges: prev.badges.filter((_, i) => i !== index),
    }))
  }

  if (loading) return <LoadingState label={ar ? 'جاري تحميل محرك التحفيز والمكافآت...' : 'Loading gamification engine...'} />
  if (error && !config) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="admin-page-container space-y-6 pb-12" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>🎮</span>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {ar ? 'محرك التحفيز والمكافآت' : 'Gamification & Rewards Engine'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1" style={{ color: 'var(--text-secondary, #6b7280)', marginTop: '4px' }}>
            {ar
              ? 'التحكم في تتابعات الدخول اليومية (Streaks)، اقتصاد النجوم، وكتالوج الأوسمة وبوابات أولياء الأمور'
              : 'Configure daily login streaks, star economy, badges catalog, and parent authorization gates'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {saveSuccess && (
            <span style={{ color: '#16a34a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon name="check" size={18} />
              {ar ? 'تم الحفظ بنجاح!' : 'Saved successfully!'}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
            }}
          >
            <Icon name="sparkles" size={18} />
            {saving ? (ar ? 'جاري الحفظ...' : 'Saving...') : (ar ? 'حفظ التعديلات' : 'Save Changes')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* KPI Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>{ar ? 'سقف النجوم اليومي' : 'Daily Star Cap'}</span>
            <span style={{ padding: '6px', borderRadius: '8px', background: '#fef3c7', color: '#b45309' }}>⭐</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: 'var(--text-primary, #111827)' }}>
            {config.economy.daily_cap} {ar ? 'نجمة' : 'stars'}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {ar ? 'حد أقصى لمنع الإفراط وإدمان الشاشات' : 'Safety limit against excessive screen time'}
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>{ar ? 'سلسلة التتابع' : 'Streak Ladder'}</span>
            <span style={{ padding: '6px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626' }}>🔥</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: 'var(--text-primary, #111827)' }}>
            {config.streaks.daily_rewards.length} {ar ? 'أيام متتالية' : 'Days'}
          </div>
          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px', fontWeight: '500' }}>
            {config.streaks.enabled ? (ar ? '● التتابع نشط' : '● Streaks Active') : (ar ? '○ التتابع معطل' : '○ Disabled')}
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>{ar ? 'أوسمة الإنجاز النشطة' : 'Active Badges'}</span>
            <span style={{ padding: '6px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca' }}>🎖️</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: 'var(--text-primary, #111827)' }}>
            {config.badges.length} {ar ? 'أوسمة' : 'Badges'}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {ar ? 'مقسمة عبر 5 مسارات معرفية وفنية' : 'Distributed across 5 cognitive tracks'}
          </div>
        </div>

        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>{ar ? 'بوابة ولي الأمر' : 'Parent Gate'}</span>
            <span style={{ padding: '6px', borderRadius: '8px', background: '#dcfce7', color: '#15803d' }}>🛡️</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: 'var(--text-primary, #111827)' }}>
            {config.parent_controls.require_parent_approval_for_redemptions ? (ar ? 'مفعلة بـ PIN' : 'PIN Protected') : (ar ? 'غير مشروطة' : 'Open')}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {ar ? 'تتطلب رمز الأمان قبل استبدال المكافأة' : 'Requires parent security PIN for redemptions'}
          </div>
        </div>
      </div>

      {/* Section 1: Daily Streaks Ladder */}
      <div style={{ padding: '24px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔥</span> {ar ? 'سلسلة التتابع والمواظبة (Daily Streaks)' : 'Daily Streaks Ladder'}
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
              {ar ? 'مكافآت الدخول اليومي المتتالي لتشجيع الأطفال على العودة بانتظام' : 'Consecutive daily login incentives to build consistent engagement'}
            </p>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={config.streaks.enabled}
              onChange={e => setConfig(prev => ({ ...prev, streaks: { ...prev.streaks, enabled: e.target.checked } }))}
              style={{ width: '18px', height: '18px' }}
            />
            {ar ? 'تفعيل نظام التتابع' : 'Enable Streaks'}
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '16px' }}>
          {config.streaks.daily_rewards.map((reward, idx) => (
            <div
              key={reward.day}
              style={{
                padding: '14px',
                borderRadius: '10px',
                border: reward.bonus ? '2px solid #f59e0b' : '1px solid var(--border-color, #e5e7eb)',
                background: reward.bonus ? 'rgba(254, 243, 199, 0.25)' : 'var(--bg-secondary, #f9fafb)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: reward.bonus ? '#b45309' : '#4b5563' }}>
                {ar ? `اليوم ${reward.day}` : `Day ${reward.day}`}
              </div>
              <div style={{ fontSize: '24px', margin: '6px 0' }}>
                {reward.bonus ? '🎁' : '⭐'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={reward.stars}
                  onChange={e => updateStreakDay(idx, Number(e.target.value) || 0, reward.bonus)}
                  style={{
                    width: '64px',
                    padding: '4px 6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                  }}
                />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>⭐</span>
              </div>
              <div style={{ marginTop: '8px' }}>
                <select
                  value={reward.bonus || ''}
                  onChange={e => updateStreakDay(idx, reward.stars, e.target.value || null)}
                  style={{
                    width: '100%',
                    fontSize: '11px',
                    padding: '4px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="">{ar ? 'بلا جائزة إضافية' : 'No bonus'}</option>
                  <option value="double_stars_30m">{ar ? '⚡ مضاعفة نجوم 30د' : 'Double Stars (30m)'}</option>
                  <option value="special_avatar_frame">{ar ? '🖼️ إطار مظهر نادر' : 'Avatar Frame'}</option>
                  <option value="super_cosmic_chest">{ar ? '💎 صندوق كوني أسطوري' : 'Cosmic Chest'}</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Star Economy Settings */}
      <div style={{ padding: '24px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span>🪙</span> {ar ? 'اقتصاد النجوم (Stars & Coin Economy)' : 'Star Economy Tuning'}
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
          {ar ? 'تحديد النجوم الممنوحة للطفل عند إتمام كل نشاط تعليمي أو ترفيهي' : 'Reward amounts awarded upon finishing activities'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
              🎬 {ar ? 'مشاهدة حلقة كرتون كاملة' : 'Full Episode Watched'}
            </label>
            <input
              type="number"
              min="0"
              max="500"
              value={config.economy.stars_per_episode}
              onChange={e => setConfig(prev => ({ ...prev, economy: { ...prev.economy, stars_per_episode: Number(e.target.value) || 0 } }))}
              style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px' }}
            />
          </div>

          <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
              🎮 {ar ? 'إتمام لعبة تفاعلية تعليمية' : 'Interactive Game Completed'}
            </label>
            <input
              type="number"
              min="0"
              max="500"
              value={config.economy.stars_per_game_completed}
              onChange={e => setConfig(prev => ({ ...prev, economy: { ...prev.economy, stars_per_game_completed: Number(e.target.value) || 0 } }))}
              style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px' }}
            />
          </div>

          <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
              📚 {ar ? 'قراءة قصة صوتية/تفاعلية كاملة' : 'Interactive Story Read'}
            </label>
            <input
              type="number"
              min="0"
              max="500"
              value={config.economy.stars_per_story_read}
              onChange={e => setConfig(prev => ({ ...prev, economy: { ...prev.economy, stars_per_story_read: Number(e.target.value) || 0 } }))}
              style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px' }}
            />
          </div>

          <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
              🎨 {ar ? 'إتقان تتبع ورسم لوحة كاملة' : 'Completed Drawing / Art Studio'}
            </label>
            <input
              type="number"
              min="0"
              max="500"
              value={config.economy.stars_per_perfect_drawing}
              onChange={e => setConfig(prev => ({ ...prev, economy: { ...prev.economy, stars_per_perfect_drawing: Number(e.target.value) || 0 } }))}
              style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px' }}
            />
          </div>

          <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
              🧠 {ar ? 'اجتياز اختبار ذكاء / كويز' : 'Quiz Passed'}
            </label>
            <input
              type="number"
              min="0"
              max="500"
              value={config.economy.stars_per_quiz_passed}
              onChange={e => setConfig(prev => ({ ...prev, economy: { ...prev.economy, stars_per_quiz_passed: Number(e.target.value) || 0 } }))}
              style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px' }}
            />
          </div>

          <div style={{ padding: '16px', borderRadius: '8px', border: '2px solid #93c5fd', background: '#eff6ff' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#1e40af' }}>
              🛑 {ar ? 'الحد الأقصى اليومي (Daily Cap)' : 'Daily Stars Cap'}
            </label>
            <input
              type="number"
              min="100"
              max="5000"
              value={config.economy.daily_cap}
              onChange={e => setConfig(prev => ({ ...prev, economy: { ...prev.economy, daily_cap: Number(e.target.value) || 0 } }))}
              style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '15px', fontWeight: 'bold' }}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Badges Catalogue */}
      <div style={{ padding: '24px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎖️</span> {ar ? 'كتالوج الأوسمة والإنجازات (Badges & Achievements)' : 'Badges & Achievements Catalog'}
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
              {ar ? 'أوسمة فخرية تمنح للطفل لتزيين ملفه الشخصي وتحفيز شغفه' : 'Badges awarded for milestones and displayed on the child profile'}
            </p>
          </div>

          <button
            onClick={openAddBadge}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Icon name="plus" size={16} />
            {ar ? 'إضافة وسام جديد' : 'New Badge'}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: ar ? 'right' : 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontSize: '12px' }}>
                <th style={{ padding: '12px' }}>{ar ? 'الرمز' : 'Icon'}</th>
                <th style={{ padding: '12px' }}>{ar ? 'اسم الوسام' : 'Badge Name'}</th>
                <th style={{ padding: '12px' }}>{ar ? 'المسار المعرفي' : 'Category'}</th>
                <th style={{ padding: '12px' }}>{ar ? 'شرط الفتح' : 'Condition'}</th>
                <th style={{ padding: '12px' }}>{ar ? 'المكافأة' : 'Reward'}</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>{ar ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {config.badges.map((badge, idx) => (
                <tr key={badge.id || badge.code} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px', fontSize: '24px' }}>{badge.icon}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: '600' }}>{badge.name_ar}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{badge.name_en} ({badge.code})</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', background: '#f3f4f6', fontSize: '12px', fontWeight: '500' }}>
                      {badge.category}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#4b5563', fontSize: '13px', fontFamily: 'monospace' }}>
                    {badge.unlock_condition}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#d97706' }}>
                    +{badge.stars_reward} ⭐
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <button
                        onClick={() => openEditBadge(badge, idx)}
                        style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}
                        title={ar ? 'تعديل' : 'Edit'}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteBadge(idx)}
                        style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                        title={ar ? 'حذف' : 'Delete'}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Parental Controls */}
      <div style={{ padding: '24px', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span>🛡️</span> {ar ? 'بوابة رقابة ومكافآت أولياء الأمور (Parental Controls)' : 'Parent Controls & Family Incentives'}
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
          {ar ? 'تعزيز شراكة الأهل وإشراكهم في ضبط الجوائز ومتابعة السلوك الإيجابي' : 'Engage parents with oversight and custom family reward approvals'}
        </p>

        <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.parent_controls.require_parent_approval_for_redemptions}
              onChange={e => setConfig(prev => ({
                ...prev,
                parent_controls: { ...prev.parent_controls, require_parent_approval_for_redemptions: e.target.checked },
              }))}
              style={{ width: '20px', height: '20px', marginTop: '2px' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {ar ? 'طلب موافقة ولي الأمر برمز PIN عند استبدال النجوم' : 'Require parent PIN approval for rewards redemption'}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {ar ? 'يمنع الطفل من حرق النجوم أو طلب جوائز دون تحقق مباشر من الأهل' : 'Ensures children do not redeem high-value perks without adult verification'}
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.parent_controls.weekly_screen_time_milestone_reward}
              onChange={e => setConfig(prev => ({
                ...prev,
                parent_controls: { ...prev.parent_controls, weekly_screen_time_milestone_reward: e.target.checked },
              }))}
              style={{ width: '20px', height: '20px', marginTop: '2px' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {ar ? 'مكافأة الانضباط الزمني الأسبوعي' : 'Weekly screen time discipline bonus'}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {ar ? 'منح نجوم بونص إضافية للطفل الذي يلتزم بحدود وقت الشاشة المحددة من والديه طوال الأسبوع' : 'Awards bonus stars when the child stays within weekly screen limits'}
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.parent_controls.allow_custom_parent_rewards}
              onChange={e => setConfig(prev => ({
                ...prev,
                parent_controls: { ...prev.parent_controls, allow_custom_parent_rewards: e.target.checked },
              }))}
              style={{ width: '20px', height: '20px', marginTop: '2px' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {ar ? 'تمكين الجوائز العائلية المخصصة (Custom Household Rewards)' : 'Enable custom household parent rewards'}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {ar ? 'السماح للأهل بإضافة مكافآت واقعية (مثل: زيارة حديقة الحيوان، شراء كتاب مفضل)' : 'Allows parents to add real-world rewards like park visits or toy choices'}
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Badge Modal */}
      {badgeModalOpen && (
        <Modal
          open={badgeModalOpen}
          title={editingBadgeIndex !== null ? (ar ? 'تعديل وسام' : 'Edit Badge') : (ar ? 'إضافة وسام جديد' : 'New Badge')}
          onClose={() => setBadgeModalOpen(false)}
        >
          <form onSubmit={handleSaveBadge} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {ar ? 'الأيقونة' : 'Icon'}
                </label>
                <input
                  type="text"
                  value={badgeForm.icon}
                  onChange={e => setBadgeForm(prev => ({ ...prev, icon: e.target.value }))}
                  style={{ width: '100%', padding: '8px', fontSize: '20px', textAlign: 'center', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {ar ? 'رمز المعرّف (Code)' : 'Code ID'}
                </label>
                <input
                  type="text"
                  required
                  value={badgeForm.code}
                  onChange={e => setBadgeForm(prev => ({ ...prev, code: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="e.g. math_wizard"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {ar ? 'الاسم بالعربية' : 'Arabic Name'}
                </label>
                <input
                  type="text"
                  required
                  value={badgeForm.name_ar}
                  onChange={e => setBadgeForm(prev => ({ ...prev, name_ar: e.target.value }))}
                  placeholder="عبقري الرياضيات"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {ar ? 'الاسم بالإنجليزية' : 'English Name'}
                </label>
                <input
                  type="text"
                  value={badgeForm.name_en}
                  onChange={e => setBadgeForm(prev => ({ ...prev, name_en: e.target.value }))}
                  placeholder="Math Wizard"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {ar ? 'المسار المعرفي' : 'Category'}
                </label>
                <select
                  value={badgeForm.category}
                  onChange={e => setBadgeForm(prev => ({ ...prev, category: e.target.value }))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                >
                  <option value="exploration">{ar ? '🚀 استكشاف الفضاء' : 'Exploration'}</option>
                  <option value="reading">{ar ? '📚 القراءة والقصص' : 'Reading'}</option>
                  <option value="creativity">{ar ? '🎨 الإبداع والرسم' : 'Creativity'}</option>
                  <option value="learning">{ar ? '🧠 العلوم والرياضيات' : 'Learning'}</option>
                  <option value="consistency">{ar ? '🔥 الالتزام والمواظبة' : 'Consistency'}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {ar ? 'مكافأة النجوم' : 'Stars Reward'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="5000"
                  value={badgeForm.stars_reward}
                  onChange={e => setBadgeForm(prev => ({ ...prev, stars_reward: Number(e.target.value) || 0 }))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                {ar ? 'شرط الفتح البرمجي (Trigger Condition)' : 'Trigger Condition'}
              </label>
              <input
                type="text"
                required
                value={badgeForm.unlock_condition}
                onChange={e => setBadgeForm(prev => ({ ...prev, unlock_condition: e.target.value }))}
                placeholder="e.g. complete_10_lessons"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setBadgeModalOpen(false)}
                style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                style={{ padding: '8px 20px', background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {ar ? 'تأكيد' : 'Confirm'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
