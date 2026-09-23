import { useEffect, useMemo, useState } from 'react';
import { creativeStudioAdmin } from '../lib/creativeStudioApi';

type Drawing = {
  id: string;
  category: string;
  title_ar: string;
  age_min: number;
  age_max: number;
  difficulty: string;
  status: string;
  sort_order: number;
  url: string | null;
  extra?: {
    pattern_rule?: string;
    mode?: 'complete_next' | 'fill_missing' | 'memory_repeat';
    sequence?: string[];
    answer?: string;
    distractors?: string[];
  } | null;
};

// 50 Master Reusable Tokens as specified in plans/copy-pattern.md
const REUSABLE_TOKENS = [
  { id: 'circle-blue', label: 'دائرة زرقاء', cat: 'shapes', icon: '🔵' },
  { id: 'square-yellow', label: 'مربع أصفر', cat: 'shapes', icon: '🟨' },
  { id: 'triangle-cyan', label: 'مثلث سماوي', cat: 'shapes', icon: '🔺' },
  { id: 'star-yellow', label: 'نجمة صفراء', cat: 'shapes', icon: '⭐' },
  { id: 'heart-pink', label: 'قلب وردي', cat: 'shapes', icon: '💖' },
  { id: 'diamond-purple', label: 'معين بنفسجي', cat: 'shapes', icon: '🔷' },
  { id: 'hexagon-green', label: 'سداسي أخضر', cat: 'shapes', icon: '🟩' },
  { id: 'circle-red', label: 'دائرة حمراء', cat: 'shapes', icon: '🔴' },

  { id: 'rocket-red', label: 'صاروخ فضائي', cat: 'space', icon: '🚀' },
  { id: 'planet-purple', label: 'كوكب بنفسجي', cat: 'space', icon: '🪐' },
  { id: 'crescent-moon', label: 'هلال ذهبي', cat: 'space', icon: '🌙' },
  { id: 'space-star', label: 'نجمة فضاء', cat: 'space', icon: '✨' },
  { id: 'earth-globe', label: 'كوكب الأرض', cat: 'space', icon: '🌍' },
  { id: 'astronaut', label: 'رائد فضاء', cat: 'space', icon: '🧑‍🚀' },
  { id: 'ufo', label: 'طبق طائر', cat: 'space', icon: '🛸' },

  { id: 'bird-blue', label: 'عصفور مغرد', cat: 'animals', icon: '🐦' },
  { id: 'kitten-orange', label: 'قطة لطيفة', cat: 'animals', icon: '🐱' },
  { id: 'puppy-brown', label: 'كلب مرح', cat: 'animals', icon: '🐶' },
  { id: 'panda-cute', label: 'باندا صغير', cat: 'animals', icon: '🐼' },
  { id: 'bunny-white', label: 'أرنب أبيض', cat: 'animals', icon: '🐰' },
  { id: 'fish-tropical', label: 'سمكة ملونة', cat: 'animals', icon: '🐠' },
  { id: 'butterfly', label: 'فراشة زاهية', cat: 'animals', icon: '🦋' },
  { id: 'dino-green', label: 'ديناصور وديع', cat: 'animals', icon: '🦖' },

  { id: 'sun-happy', label: 'شمس مشرقة', cat: 'nature', icon: '☀️' },
  { id: 'cloud-fluffy', label: 'سحابة قطنية', cat: 'nature', icon: '☁️' },
  { id: 'flower-pink', label: 'زهرة وردية', cat: 'nature', icon: '🌸' },
  { id: 'tree-green', label: 'شجرة مورقة', cat: 'nature', icon: '🌳' },
  { id: 'apple-red', label: 'تفاحة حمراء', cat: 'nature', icon: '🍎' },
  { id: 'rainbow', label: 'قوس قزح', cat: 'nature', icon: '🌈' },

  { id: 'car-red', label: 'سيارة حمراء', cat: 'vehicles', icon: '🚗' },
  { id: 'bus-yellow', label: 'حافلة صفراء', cat: 'vehicles', icon: '🚌' },
  { id: 'train-steam', label: 'قطار سريع', cat: 'vehicles', icon: '🚂' },
  { id: 'plane-blue', label: 'طائرة سفر', cat: 'vehicles', icon: '✈️' },
  { id: 'boat-sailboat', label: 'قارب شراعي', cat: 'vehicles', icon: '⛵' },
];

const PATTERN_RULES = ['AB', 'ABC', 'AABB', 'AAB', 'ABB', 'ABCD'];
const PLAY_MODES = [
  { id: 'complete_next', label: 'إكمال العنصر التالي', desc: 'معرفة الرمز القادم في المتتالية' },
  { id: 'fill_missing', label: 'ملء العنصر الناقص', desc: 'تحديد الرمز المفقود بالمنتصف' },
  { id: 'memory_repeat', label: 'إعادة من الذاكرة', desc: 'حفظ النمط ثم إعادته كاملاً' },
];

const api = creativeStudioAdmin;

export default function CreativeCopyPatternAdminPage() {
  const [patterns, setPatterns] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedRule, setSelectedRule] = useState('all');

  // Pattern Builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderForm, setBuilderForm] = useState({
    title_ar: '',
    difficulty: 'سهل',
    age_min: 4,
    age_max: 7,
    mode: 'complete_next' as 'complete_next' | 'fill_missing' | 'memory_repeat',
    rule: 'ABC',
    sequence: ['rocket-red', 'planet-purple', 'star-yellow', 'rocket-red', 'planet-purple'],
    answer: 'star-yellow',
    distractors: ['heart-pink', 'crescent-moon'],
  });

  async function load() {
    setLoading(true);
    const res = await api('/creative-studio/drawings?category=copy_pattern&limit=100');
    if (res.success) {
      setPatterns((res.data as Drawing[]).sort((a, b) => a.sort_order - b.sort_order));
      setMsg(null);
    } else {
      setPatterns([]);
      setMsg(`خطأ تحميل: ${res.error || 'تعذر جلب الأنماط'}`);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function addTokenToSequence(tokenId: string) {
    if (builderForm.sequence.length >= 8) return;
    setBuilderForm(prev => ({
      ...prev,
      sequence: [...prev.sequence, tokenId],
    }));
  }

  function removeSequenceIndex(index: number) {
    setBuilderForm(prev => ({
      ...prev,
      sequence: prev.sequence.filter((_, i) => i !== index),
    }));
  }

  async function savePattern() {
    if (!builderForm.title_ar.trim()) {
      setMsg('يرجى إدخال عنوان للنشاط');
      return;
    }
    if (builderForm.sequence.length < 3) {
      setMsg('يجب أن تحتوي المتتالية على 3 عناصر على الأقل');
      return;
    }

    const id = `pattern-${Date.now()}`;
    const payload = {
      id,
      category: 'copy_pattern',
      title_ar: builderForm.title_ar.trim(),
      difficulty: builderForm.difficulty,
      age_min: builderForm.age_min,
      age_max: builderForm.age_max,
      status: 'ready',
      sort_order: patterns.length + 1,
      r2_key: `public/studio/patterns/${id}.json`,
      extra: {
        pattern_rule: builderForm.rule,
        mode: builderForm.mode,
        sequence: builderForm.sequence,
        answer: builderForm.answer,
        distractors: builderForm.distractors,
      },
    };

    const res = await api('/creative-studio/drawings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setMsg(`تم إنشاء نشاط النمط "${builderForm.title_ar}" بنجاح ✨`);
      setShowBuilder(false);
      await load();
    } else {
      setMsg(`فشل الحفظ: ${res.error}`);
    }
  }

  async function toggleStatus(id: string, status: string) {
    const res = await api(`/creative-studio/drawings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (res.success) await load();
  }

  const tokenMap = useMemo(() => {
    return new Map(REUSABLE_TOKENS.map(t => [t.id, t]));
  }, []);

  const filteredPatterns = useMemo(() => {
    return patterns.filter(p => {
      const matchesRule = selectedRule === 'all' || p.extra?.pattern_rule === selectedRule;
      const matchesSearch = !search.trim() || p.title_ar.includes(search) || p.id.includes(search.toLowerCase());
      return matchesRule && matchesSearch;
    });
  }, [patterns, selectedRule, search]);

  return (
    <div className="studio-page" dir="rtl">
      <div className="studio-ambient" />

      {/* Hero Header */}
      <header className="studio-hero">
        <div className="studio-hero__header">
          <div className="studio-hero__brand">
            <div className="studio-hero__icon-badge">🔲</div>
            <div className="studio-hero__title-wrap">
              <h1>
                استوديو انسخ النمط (Copy Pattern Studio)
                <span className="studio-hero__pill">معمارية الـ 50 عنصراً Reusable</span>
              </h1>
              <p className="studio-hero__desc">
                بناء متتاليات الأنماط المنطقية للأطفال لتعزيز الإدراك والذاكرة البصرية، بالاعتماد على مكتبة الرموز الـ 50 المعتمدة في خطة التطوير.
              </p>
            </div>
          </div>
          <div className="studio-hero__actions">
            <button className="studio-btn studio-btn--primary" onClick={() => setShowBuilder(true)}>
              <span>✨</span>
              <span>بناء نمط جديد</span>
            </button>
            <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={load} title="تحديث">
              <span>🔄</span>
            </button>
          </div>
        </div>

        {/* Bento Metrics */}
        <div className="studio-metrics">
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">إجمالي الأنماط</div>
            <div className="studio-metric-card__value">{patterns.length}</div>
            <div className="studio-metric-card__sub">تحدي نمط تفاعلي</div>
          </div>
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">الأنماط الجاهزة والمنشورة</div>
            <div className="studio-metric-card__value studio-metric-card__value--success">
              {patterns.filter(p => p.status === 'published' || p.status === 'ready').length}
            </div>
            <div className="studio-metric-card__sub">متاحة في التطبيق</div>
          </div>
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">مكتبة العناصر المستقلة</div>
            <div className="studio-metric-card__value">{REUSABLE_TOKENS.length}</div>
            <div className="studio-metric-card__sub">رمز ثلاثي الأبعاد جاهز</div>
          </div>
          <div className="studio-metric-card">
            <div className="studio-metric-card__label">أوضاع اللعب</div>
            <div className="studio-metric-card__value">3</div>
            <div className="studio-metric-card__sub">إكمال، فراغ، ذاكرة</div>
          </div>
        </div>
      </header>

      {/* Notice */}
      {msg && (
        <div className="studio-notice">
          <span>{msg}</span>
          <button className="studio-btn studio-btn--secondary studio-btn--sm" onClick={() => setMsg(null)}>إغلاق</button>
        </div>
      )}

      {/* Token Showcase Rail */}
      <section className="studio-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
            💎 مكتبة العناصر الـ 50 (Reusable Master Tokens)
          </h4>
          <span style={{ fontSize: 12, color: 'var(--studio-text-muted)' }}>
            عناصر موحدة عالية الجودة تُبنى منها مئات المتتاليات
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
          {REUSABLE_TOKENS.slice(0, 18).map(token => (
            <div
              key={token.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'var(--studio-surface-raised)',
                border: '1px solid var(--studio-border)',
                minWidth: 84,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 28 }}>{token.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{token.label}</span>
              <span style={{ fontSize: 9, color: 'var(--studio-text-muted)', fontFamily: 'monospace' }}>{token.id}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Grid of Patterns with Rule Chips & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>أنشطة الأنماط</h3>
          <div className="studio-chips">
            {['all', ...PATTERN_RULES].map(r => (
              <button
                key={r}
                onClick={() => setSelectedRule(r)}
                className={`studio-chip ${selectedRule === r ? 'studio-chip--active' : ''}`}
                style={{ height: 28, padding: '0 12px', fontSize: 11 }}
              >
                {r === 'all' ? 'جميع القواعد' : r}
              </button>
            ))}
          </div>
        </div>
        <div className="studio-search" style={{ minWidth: 260 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في الأنماط..."
          />
          <span className="studio-search__icon">🔍</span>
        </div>
      </div>

      {loading ? (
        <div className="studio-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="studio-card" style={{ height: 260, opacity: 0.5 }} />
          ))}
        </div>
      ) : filteredPatterns.length === 0 ? (
        <div className="studio-card" style={{ padding: '60px 20px', textAlign: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>🔲</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>لا توجد أنشطة أنماط تطابق خيارات البحث</h3>
          <p style={{ margin: '0 0 18px', color: 'var(--studio-text-muted)', fontSize: 13 }}>
            استخدم محرر بناء الأنماط لإنشاء أول متتالية تفاعلية للأطفال أو أعد ضبط الفلاتر!
          </p>
          <button onClick={() => setShowBuilder(true)} className="studio-btn studio-btn--primary">
            إنشاء نمط تفاعلي
          </button>
        </div>
      ) : (
        <div className="studio-grid">
          {filteredPatterns.map(p => {
            const seq = p.extra?.sequence || [];
            const ans = p.extra?.answer;
            return (
              <article key={p.id} className="studio-card">
                {/* Visual Sequence Rail */}
                <div
                  style={{
                    padding: 16,
                    background: 'var(--studio-surface-raised)',
                    borderBottom: '1px solid var(--studio-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {seq.map((tokId, index) => {
                      const tok = tokenMap.get(tokId);
                      return (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: 6,
                            borderRadius: 8,
                            background: 'var(--studio-surface)',
                            border: '1px solid var(--studio-border)',
                          }}
                        >
                          <span style={{ fontSize: 24 }}>{tok?.icon || '🔹'}</span>
                        </div>
                      );
                    })}
                    <div
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: 'rgba(99, 102, 241, 0.2)',
                        border: '2px dashed var(--studio-primary)',
                        color: 'var(--studio-primary)',
                        fontWeight: 900,
                        fontSize: 18,
                      }}
                    >
                      ?
                    </div>
                  </div>
                </div>

                <div className="studio-card__body">
                  <div className="studio-card__title-row">
                    <div>
                      <h4 className="studio-card__title">{p.title_ar}</h4>
                      <span className="studio-card__id">{p.id}</span>
                    </div>
                  </div>

                  <div className="studio-card__meta">
                    <span className="studio-card__tag">قاعدة: {p.extra?.pattern_rule || 'مخصص'}</span>
                    <span className="studio-card__tag">وضع: {p.extra?.mode || 'إكمال'}</span>
                    <span className="studio-card__tag">👶 {p.age_min}-{p.age_max} سنوات</span>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--studio-text-muted)' }}>
                    الإجابة الصحيحة: <strong>{tokenMap.get(ans || '')?.label || ans || 'غير محدد'}</strong>
                  </div>

                  <div className="studio-card__actions">
                    <select
                      value={p.status}
                      onChange={e => void toggleStatus(p.id, e.target.value)}
                      className="studio-select"
                      style={{ height: 32, fontSize: 11, flex: 1 }}
                    >
                      <option value="draft">مسودة</option>
                      <option value="ready">جاهز للمراجعة</option>
                      <option value="published">منشور</option>
                    </select>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pattern Builder Modal Drawer */}
      {showBuilder && (
        <div className="studio-drawer">
          <div onClick={() => setShowBuilder(false)} className="studio-drawer__backdrop" />
          <div className="studio-drawer__panel" style={{ width: 'min(640px, 100vw)' }}>
            <div className="studio-drawer__header">
              <h3>🎨 محرر بناء النمط التفاعلي</h3>
              <button onClick={() => setShowBuilder(false)} className="studio-btn studio-btn--secondary studio-btn--sm">✕</button>
            </div>

            <div className="studio-drawer__body">
              <div className="studio-field-group">
                <label>عنوان التحدي *</label>
                <input
                  className="studio-input"
                  value={builderForm.title_ar}
                  onChange={e => setBuilderForm({ ...builderForm, title_ar: e.target.value })}
                  placeholder="مثال: نمط الفضاء السحري (صاروخ - كوكب - نجمة)"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="studio-field-group">
                  <label>قاعدة النمط</label>
                  <select
                    className="studio-select"
                    value={builderForm.rule}
                    onChange={e => setBuilderForm({ ...builderForm, rule: e.target.value })}
                  >
                    {PATTERN_RULES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="studio-field-group">
                  <label>وضع التحدي</label>
                  <select
                    className="studio-select"
                    value={builderForm.mode}
                    onChange={e => setBuilderForm({ ...builderForm, mode: e.target.value as any })}
                  >
                    {PLAY_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Interactive Sequence Rail Builder */}
              <div className="studio-field-group">
                <label>متتالية النمط الحالية (اضغط على أي عنصر لحذفه):</label>
                <div className="studio-pattern-rail">
                  {builderForm.sequence.map((tokId, index) => {
                    const tok = tokenMap.get(tokId);
                    return (
                      <div
                        key={index}
                        onClick={() => removeSequenceIndex(index)}
                        className="studio-pattern-slot studio-pattern-slot--active"
                        title="انقر للحذف"
                        style={{ cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: 32 }}>{tok?.icon || '🔹'}</span>
                        <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 9, color: '#ef4444' }}>✕</span>
                      </div>
                    );
                  })}
                  <div className="studio-pattern-slot" style={{ borderStyle: 'solid', borderColor: '#6366f1' }}>
                    <span style={{ fontSize: 24, color: '#6366f1', fontWeight: 900 }}>❓</span>
                  </div>
                </div>
              </div>

              {/* Token Selector Palette */}
              <div className="studio-field-group">
                <label>انقر لإضافة رمز إلى المتتالية:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 8, maxHeight: 180, overflowY: 'auto', padding: 8, background: 'var(--studio-surface-raised)', borderRadius: 12 }}>
                  {REUSABLE_TOKENS.map(tok => (
                    <button
                      key={tok.id}
                      onClick={() => addTokenToSequence(tok.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: 6,
                        borderRadius: 8,
                        background: 'var(--studio-surface)',
                        border: '1px solid var(--studio-border)',
                        cursor: 'pointer',
                      }}
                      title={tok.label}
                    >
                      <span style={{ fontSize: 24 }}>{tok.icon}</span>
                      <span style={{ fontSize: 9, color: 'var(--studio-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', whiteSpace: 'nowrap' }}>
                        {tok.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Answer & Distractors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="studio-field-group">
                  <label>الإجابة الصحيحة المطلوبة:</label>
                  <select
                    className="studio-select"
                    value={builderForm.answer}
                    onChange={e => setBuilderForm({ ...builderForm, answer: e.target.value })}
                  >
                    {REUSABLE_TOKENS.map(tok => (
                      <option key={tok.id} value={tok.id}>{tok.icon} {tok.label}</option>
                    ))}
                  </select>
                </div>
                <div className="studio-field-group">
                  <label>مستوى الصعوبة</label>
                  <select
                    className="studio-select"
                    value={builderForm.difficulty}
                    onChange={e => setBuilderForm({ ...builderForm, difficulty: e.target.value })}
                  >
                    <option>سهل</option>
                    <option>متوسط</option>
                    <option>مفصل</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="studio-drawer__footer">
              <button onClick={() => void savePattern()} className="studio-btn studio-btn--primary" style={{ flex: 1 }}>
                حفظ نمط التحدي
              </button>
              <button onClick={() => setShowBuilder(false)} className="studio-btn studio-btn--secondary">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
