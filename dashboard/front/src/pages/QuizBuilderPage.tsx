import { useState } from 'react'

type QType = 'choice' | 'true_false' | 'order' | 'match' | 'image'

export function QuizBuilderPage() {
  const [questions, setQuestions] = useState<any[]>([
    { id: 'q1', type: 'choice', text: 'ماذا وجد الأرنب؟', options: ['جزرة', 'خريطة', 'نجمة'], correct: 1 },
  ])
  const [type, setType] = useState<QType>('choice')

  function add() {
    const text = prompt('نص السؤال')
    if (!text) return
    setQuestions([...questions, { id: `q-${Date.now()}`, type, text, options: type === 'choice' ? ['أ', 'ب', 'ج'] : [], correct: 0 }])
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">التعليم</span><h2>بنك الأسئلة</h2><p>اختيار/صح وخطأ/ترتيب/مطابقة/صورة + تلميح + ربط بهدف تعليمي</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={type} onChange={e => setType(e.target.value as QType)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <option value="choice">اختيار</option><option value="true_false">صح/خطأ</option><option value="order">ترتيب</option><option value="match">مطابقة</option><option value="image">صورة</option>
          </select>
          <button className="button button--primary" onClick={add}>سؤال جديد</button>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 12 }}>
        {questions.map((q, idx) => (
          <div key={q.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 13 }}>{idx + 1}. {q.text} <small style={{ color: '#64748b' }}>({q.type})</small></strong>
              <button className="icon-button" onClick={() => setQuestions(questions.filter(x => x.id !== q.id))}>×</button>
            </div>
            {q.options && <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{q.options.map((o: string, i: number) => <span key={i} style={{ padding: '4px 10px', borderRadius: 6, background: i === q.correct ? '#dcfce7' : '#f1f5f9', fontSize: 12, border: i === q.correct ? '1px solid #16a34a' : '1px solid #e2e8f0' }}>{o} {i === q.correct ? '✓' : ''}</span>)}</div>}
            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>مرتبط بهدف: مهارة القراءة • صعوبة: متوسط • Randomization: مفعل</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, display: 'flex', gap: 8 }}>
        <button className="button button--ghost" onClick={() => alert('معاينة على موبايل/تابلت')}>معاينة</button>
        <button className="button button--ghost" onClick={() => alert('بنك أسئلة: استيراد/تصدير')}>استيراد</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#64748b', alignSelf: 'center' }}>معاينة على الأجهزة + Randomization</span>
      </div>
    </div>
  )
}
