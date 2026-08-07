import { Ico, QrCode } from '../icons'
import { AudioWave } from './Hero'
import { Brand } from './SiteHeader'
import {
  APP_URL,
  DEVICES,
  FAQ_ITEMS,
  FOOTER_COLUMNS,
  IDENTITY_POINTS,
  IDENTITY_POSTERS,
  LEARNING_FLOW,
  LEARNING_TAGS,
  ltr,
  PILLARS,
  READING_MODES,
  REVIEWS,
  REVIEW_METHOD,
  SAFETY_FEATURES,
  SIGNUP_URL,
  SOCIAL_LINKS,
  START_STEPS,
  STORY_FEATURES,
  TRUST_ITEMS,
  UNIVERSE_STEPS,
} from '../data'

/* ------------------------------------------------------------------- trust */

export function TrustStrip() {
  return (
    <div className="mj-trust" data-section="trust">
      <div className="mj-container">
        <div className="mj-trust-grid">
          {TRUST_ITEMS.map((item) => (
            <div className="mj-trust-item" key={item.label}>
              <Ico name={item.icon} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- pillars */

export function Pillars() {
  return (
    <section className="mj-section" id="pillars" data-section="pillars">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">خمسة أعمدة في منصة واحدة</span>
          <h2>كل ما يحبه طفلك <span className="mj-grad">في مكان واحد</span></h2>
          <p>
            مجرة ليست مكتبة فيديو فقط. المشاهدة والقراءة والاستماع واللعب والتعلّم مترابطة
            في تجربة واحدة، ولكل منها مساحة مصممة لعمر الطفل.
          </p>
        </div>

        <div className="mj-pillars">
          {PILLARS.map((pillar) => (
            <article className={`mj-pillar mj-pillar--${pillar.key} mj-reveal`} key={pillar.key}>
              <span className="mj-pillar-ico"><Ico name={pillar.icon} /></span>
              <h3>{pillar.title}</h3>
              <p>{pillar.copy}</p>
              <div className="mj-pillar-preview" aria-hidden="true">
                {pillar.previews.map((src) => <img src={src} alt="" key={src} loading="lazy" />)}
              </div>
              <a className="mj-pillar-link" href={pillar.href}>
                {pillar.linkLabel}
                <Ico name="arrowNext" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------- stories planet  */

export function StoriesPlanet() {
  return (
    <section className="mj-section mj-section-alt" id="stories" data-section="stories">
      <div className="mj-container">
        <div className="mj-stories">
          <div className="mj-reveal">
            <div className="mj-reader">
              <div className="mj-reader-screen">
                <img src="/landing/books/covers/book-nature-cover.webp" alt="صفحة من قصة في الطبيعة" loading="lazy" />
                <div className="mj-page-text">
                  <p>
                    خرجت <mark>نُهى</mark> إلى الحديقة، ورأت نملة صغيرة تحمل حبة أكبر منها.
                    توقفت وسألت: كيف تحملها كل هذا الطريق؟
                  </p>
                </div>
              </div>
              <div className="mj-reader-audio">
                <span className="mj-play" aria-hidden="true"><Ico name="play" solid /></span>
                <AudioWave />
                <small>صفحة 4 من 22 · صوت الراوي</small>
              </div>
            </div>
          </div>

          <div className="mj-reveal">
            <span className="mj-kicker">كوكب القصص</span>
            <h2 className="mj-subhead">قصة يقرأها طفلك… أو تستيقظ وتروي نفسها</h2>
            <p className="mj-lead">
              أربعة أوضاع قراءة تناسب كل مرحلة، من الطفل الذي لا يقرأ بعد إلى القارئ المستقل
              الذي يفضّل الصوت خلفية فقط.
            </p>

            <div className="mj-modes">
              {READING_MODES.map((mode) => (
                <div className="mj-mode" key={mode.title}>
                  <Ico name={mode.icon} />
                  <span>
                    <strong>{mode.title}</strong>
                    <span>{mode.copy}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mj-fchips">
              {STORY_FEATURES.map((feature) => (
                <span className="mj-fchip" key={feature.label}>
                  <Ico name={feature.icon} />
                  {feature.label}
                </span>
              ))}
            </div>

            <div className="mj-mt-lg">
              <a className="mj-btn mj-btn-primary" href="/worlds/stories">
                اكتشف كوكب القصص
                <Ico name="arrowNext" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- parents */

export function Parents() {
  return (
    <section className="mj-section mj-section-alt" id="parents" data-section="parents">
      <div className="mj-container">
        <div className="mj-parents mj-reveal">
          <div className="mj-parents-grid">
            <div className="mj-parents-copy">
              <span className="mj-kicker">آمن ومصمم للأهل</span>
              <h2 className="mj-subhead">طفلك يستكشف بحرية… وأنت تظل مطمئنًا</h2>
              <p className="mj-lead">
                الأمان في مجرة ليس شعارًا. هو أدوات فعلية داخل التطبيق:
                من يشاهد، وماذا يشاهد، وكم من الوقت، وماذا استفاد.
              </p>

              <div className="mj-safety">
                {SAFETY_FEATURES.map((feature) => (
                  <span className="mj-fchip" key={feature.label}>
                    <Ico name={feature.icon} />
                    {feature.label}
                  </span>
                ))}
              </div>

              <div className="mj-inline-chips mj-mt-lg">
                <a className="mj-btn mj-btn-primary" href="/parents">
                  لوحة ولي الأمر
                  <Ico name="arrowNext" />
                </a>
                <a className="mj-btn mj-btn-ghost" href="/safety">سياسة الأمان ومراجعة المحتوى</a>
              </div>
            </div>

            <div className="mj-parents-visual">
              <div className="mj-dash">
                <div className="mj-dash-bar" aria-hidden="true">
                  <i /><i /><i />
                  <span>لوحة ولي الأمر · app.majarra.app</span>
                </div>
                <img
                  src="/landing/app/parent/parent-dashboard-hero.webp"
                  alt="لوحة ولي الأمر تعرض تقدم كل طفل وحدود وقت الشاشة والتقرير الأسبوعي"
                  loading="lazy"
                />
              </div>

              <div className="mj-dash-mini">
                <figure>
                  <img
                    src="/landing/app/parent/weekly-report-illustration.webp"
                    alt="نموذج التقرير الأسبوعي لتقدم الطفل"
                    loading="lazy"
                  />
                  <figcaption>التقرير الأسبوعي</figcaption>
                </figure>
                <figure>
                  <img
                    src="/landing/app/parent/screen-time-control-illustration.webp"
                    alt="شاشة ضبط حدود وقت الشاشة"
                    loading="lazy"
                  />
                  <figcaption>حدود وقت الشاشة</figcaption>
                </figure>
              </div>

              <p className="mj-dash-caption">
                <strong>شاشات حقيقية من التطبيق:</strong> كل طفل يظهر منفصلًا، بلا دمج أعمار مختلفة
                في درجة واحدة، ومع توضيح المهارات التي تحتاج مراجعة.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- learning */

export function Learning() {
  return (
    <section className="mj-section" id="learning" data-section="learning">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">الفلسفة التعليمية</span>
          <h2>يتعلم دون أن يشعر <span className="mj-grad">أنه في درس</span></h2>
          <p>
            مجرة ليست مدرسة رقمية. هي منصة ترفيهية لها قيمة تعليمية منظمة: كل قصة أو لعبة أو حلقة
            مرتبطة بمهارة وهدف ومستوى وقيمة ونشاط بعد المحتوى.
          </p>
        </div>

        <div className="mj-flow">
          {LEARNING_FLOW.map((step) => (
            <div className="mj-flow-step mj-reveal" key={step.title}>
              <span className="mj-flow-num"><Ico name={step.icon} /></span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </div>
          ))}
        </div>

        <div className="mj-meta-tags mj-reveal">
          {LEARNING_TAGS.map((tag) => (
            <span className="mj-chip" key={tag.label}>
              <Ico name={tag.icon} />
              {tag.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- identity */

export function Identity() {
  return (
    <section className="mj-section mj-section-alt" id="identity" data-section="identity">
      <div className="mj-container">
        <div className="mj-identity mj-reveal">
          <div className="mj-identity-grid">
            <div>
              <span className="mj-kicker">الهوية واللغة والقيم</span>
              <h2 className="mj-subhead">محتوى يحب لغتنا ويحترم قيمنا</h2>
              <p className="mj-lead">
                العربية الفصحى المبسطة هي الأساس، والقيم تظهر في السلوك داخل القصة
                لا في خطبة على الطفل.
              </p>

              <ul className="mj-identity-list">
                {IDENTITY_POINTS.map((point) => (
                  <li key={point}>
                    <Ico name="check" />
                    {point}
                  </li>
                ))}
              </ul>

              <p className="mj-review-note">
                لا يُقاس التدين ولا يُعرض «تقييم إيماني» لأي طفل. المحتوى الإيماني تصنيف داخل مجرة
                كبقية العوالم، ويظل ضمن التجربة العامة لا منفصلًا عنها.
              </p>
            </div>

            <div className="mj-identity-posters">
              {IDENTITY_POSTERS.map((poster) => (
                <figure key={poster.caption}>
                  <img src={poster.image} alt={poster.alt} loading="lazy" />
                  <figcaption>{poster.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- devices */

export function Devices() {
  return (
    <section className="mj-section mj-section-alt" id="devices" data-section="devices">
      <div className="mj-container">
        <div className="mj-devices">
          <div className="mj-reveal">
            <span className="mj-kicker">كل الأجهزة</span>
            <h2 className="mj-subhead">ابدأ القصة على التابلت، وأكملها على التلفزيون</h2>
            <p className="mj-lead">
              موضع القراءة والمشاهدة يتنقل مع الطفل بين الأجهزة، والتلفزيون يتحول إلى عرض سينمائي
              بتنقّل D-pad واضح.
            </p>

            <div className="mj-device-list">
              {DEVICES.map((device) => (
                <div className="mj-device" key={device.name}>
                  <Ico name={device.icon} />
                  <span>
                    <b>{device.name}</b>
                    <small>{device.note}</small>
                  </span>
                </div>
              ))}
            </div>

            <div className="mj-continuity">
              <strong>Offline:</strong> نزّل الحلقات والقصص والألعاب في باقة العائلة، وشاهد في السيارة
              أو الطائرة دون إنترنت. التنزيلات تبقى تحت تحكم ولي الأمر.
            </div>

            <div className="mj-store-row">
              <a className="mj-store" href="/download">
                <Ico name="googlePlay" />
                <span>
                  <b>Google Play</b>
                  <small>تحميل التطبيق</small>
                </span>
              </a>
              <a className="mj-store" href="/download">
                <Ico name="appStore" />
                <span>
                  <b>App Store</b>
                  <small>تحميل التطبيق</small>
                </span>
              </a>
              <div className="mj-qr-box">
                <QrCode label="رمز QR لتحميل تطبيق مجرة" />
                <p>وجّه كاميرا الهاتف<br />لتحميل تطبيق مجرة</p>
              </div>
            </div>
          </div>

          <div className="mj-reveal">
            <div className="mj-stage">
              <div>
                <div className="mj-tv">
                  <img
                    src="/landing/series/banners/junior-journey-civilizations-banner.webp"
                    alt="سلسلة رحلة الحضارات على شاشة التلفزيون"
                    loading="lazy"
                  />
                </div>
                <span className="mj-tv-stand" aria-hidden="true" />
              </div>
              <div className="mj-tablet">
                <img
                  src="/landing/books/covers/book-human-body-cover.webp"
                  alt="كتاب رحلة داخل الجسم على تابلت"
                  loading="lazy"
                />
              </div>
              <div className="mj-phone">
                <img
                  src="/landing/series/posters/junior-robo-codes-poster.webp"
                  alt="سلسلة روبو والشيفرات على الهاتف"
                  loading="lazy"
                />
              </div>
              <div className="mj-float mj-float--a">
                <span className="mj-float-ico" style={{ color: '#38d996', background: 'rgba(56,217,150,.12)' }}>
                  <Ico name="download" />
                </span>
                <span>
                  <strong>3 حلقات محمّلة</strong>
                  <span>جاهزة للمشاهدة دون إنترنت</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- originals */

export function Originals() {
  return (
    <section className="mj-section" id="originals" data-section="originals">
      <div className="mj-container">
        <div className="mj-head mj-reveal">
          <span className="mj-kicker">مجـرة الأصلية</span>
          <h2>عوالم من إنتاجنا، <span className="mj-grad">لا مجرد محتوى مرخص</span></h2>
          <p>
            سلاسل وقصص وشخصيات وألعاب من صناعة مجرة، مترابطة في عالم واحد.
            الطفل يشاهد الحلقة، ثم يقرأ قصتها، ثم يلعب لعبتها، ثم يكمل تحديها.
          </p>
        </div>

        <div className="mj-orig-hero mj-reveal">
          <img
            src="/landing/series/banners/junior-robo-codes-banner.webp"
            alt="مشهد سينمائي من سلسلة روبو والشيفرات الأصلية"
            loading="lazy"
          />
          <div className="mj-orig-caption">
            <h3>روبو والشيفرات</h3>
            <p>
              سلسلة أصلية عن التفكير المنطقي والبرمجة، بشخصية «روبو» المصممة داخل مجرة،
              ومعها كوميكس ولعبة تسلسل ومشروع بناء دائرة.
            </p>
            <div className="mj-inline-chips">
              <span className="mj-chip">{ltr('9–12')} سنة</span>
              <span className="mj-chip">موسمان</span>
              <span className="mj-chip">عربي · English</span>
              <span className="mj-chip mj-chip-premium">Majarra Original</span>
            </div>
          </div>
        </div>

        <div className="mj-universe">
          {UNIVERSE_STEPS.map((step) => (
            <div className="mj-universe-step mj-reveal" key={step.title}>
              <Ico name={step.icon} />
              <b>{step.title}</b>
              <small>{step.note}</small>
            </div>
          ))}
        </div>

        <div className="mj-center mj-mt-lg mj-reveal">
          <a className="mj-btn mj-btn-ghost" href="/originals">
            كل أعمال مجرة الأصلية
            <Ico name="arrowNext" />
          </a>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- start */

export function StartSteps() {
  return (
    <section className="mj-section mj-section-alt" id="start" data-section="start">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">ثلاث خطوات</span>
          <h2>كيف تبدأ؟</h2>
          <p>
            دقيقتان تكفيان لإنشاء حساب الأسرة وأول ملف طفل. لا نطلب بيانات لا نحتاجها،
            ولا نُسجّل الطفل باسمه الكامل.
          </p>
        </div>

        <div className="mj-steps">
          {START_STEPS.map((step, index) => (
            <article className="mj-step mj-reveal" key={step.title}>
              <span className="mj-step-num">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>

        <div className="mj-center mj-mt-lg mj-reveal">
          <a className="mj-btn mj-btn-primary mj-btn-lg" href={SIGNUP_URL}>
            ابدأ الآن
            <Ico name="arrowStart" />
          </a>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- reviews */

export function Reviews() {
  return (
    <section className="mj-section mj-section-alt" id="reviews" data-section="reviews">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">الثقة</span>
          <h2>كيف نراجع المحتوى قبل أن يراه طفلك</h2>
          <p>
            لم نطلق للجمهور بعد، ولذلك لا نعرض تقييمات ولا أعداد مستخدمين.
            نعرض بدلًا منها منهج المراجعة، وآراء موثقة من برنامج الاختبار المبكر.
          </p>
        </div>

        <div className="mj-method">
          {REVIEW_METHOD.map((step) => (
            <div className="mj-method-step mj-reveal" key={step.title}>
              <Ico name={step.icon} />
              <b>{step.title}</b>
              <p>{step.copy}</p>
            </div>
          ))}
        </div>

        <div className="mj-reviews">
          {REVIEWS.map((review) => (
            <article className="mj-review mj-reveal" key={review.quote}>
              <span className="mj-review-tag">{review.tag}</span>
              <blockquote>{review.quote}</blockquote>
              <div className="mj-review-who">
                <img src={review.avatar} alt="" loading="lazy" />
                <div>
                  <b>{review.name}</b>
                  <small>{review.note}</small>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mj-honesty">
          لا نستخدم تقييمات أو شهادات مصطنعة، ولا نعرض أرقامًا مثل «مليون مستخدم» أو «آلاف القصص»
          قبل أن تكون حقيقية وقابلة للإثبات. الاقتباسات أعلاه من أسر شاركت في الاختبار المبكر
          بموافقتها، وبأسماء مختصرة حفاظًا على خصوصيتها.
        </p>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------- FAQ */

export function Faq() {
  return (
    <section className="mj-section" id="faq" data-section="faq">
      <div className="mj-container">
        <div className="mj-head mj-head--center mj-reveal">
          <span className="mj-kicker">الأسئلة الشائعة</span>
          <h2>أسئلة يسألها الأهل قبل الاشتراك</h2>
        </div>

        <div className="mj-faq-grid">
          {FAQ_ITEMS.map((item) => (
            <details className="mj-faq mj-reveal" key={item.q}>
              <summary>
                {item.q}
                <Ico name="plus" />
              </summary>
              <div className="mj-faq-body">{item.a}</div>
            </details>
          ))}
        </div>

        <div className="mj-center mj-mt-lg mj-reveal">
          <a className="mj-btn mj-btn-ghost" href="/help">
            مركز المساعدة وكل الأسئلة
            <Ico name="arrowNext" />
          </a>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- download */

export function DownloadCta() {
  return (
    <section className="mj-cta-section" id="download" data-section="download">
      <div className="mj-container">
        <div className="mj-cta mj-reveal">
          <h2>ابدأ رحلة طفلك في مجرة اليوم</h2>
          <p>
            أنشئ حساب الأسرة مجانًا، أضف ملف طفلك، ودعه يستكشف عالمًا آمنًا
            من الحكايات والمعرفة.
          </p>
          <div className="mj-cta-actions">
            <a className="mj-btn mj-btn-primary mj-btn-lg" href={SIGNUP_URL}>
              ابدأ تجربتك المجانية
              <Ico name="arrowStart" />
            </a>
            <a className="mj-btn mj-btn-ghost mj-btn-lg" href="/download">
              حمّل التطبيق
              <Ico name="download" />
            </a>
          </div>
          <p className="mj-cta-fine">
            بلا بطاقة بنكية · إلغاء في أي وقت · متاح على الموبايل والتابلت والتلفزيون والويب
          </p>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ footer */

export function SiteFooter() {
  return (
    <footer className="mj-footer" data-section="footer">
      <div className="mj-container">
        <div className="mj-footer-grid">
          <div className="mj-footer-about">
            <Brand />
            <p>
              منصة عربية آمنة للأطفال من 3 إلى 12 سنة، تجمع المشاهدة والقراءة والاستماع واللعب
              والتعلّم في تجربة واحدة، مع أدوات حقيقية للأهل.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div className="mj-footer-col" key={column.title}>
              <h3>{column.title}</h3>
              {column.links.map((link) => (
                <a href={link.href} key={link.label}>{link.label}</a>
              ))}
            </div>
          ))}
        </div>

        <div className="mj-footer-meta">
          <div className="mj-footer-meta-group">
            <label className="mj-sr-only" htmlFor="mj-footer-lang">اللغة</label>
            <select className="mj-footer-select" id="mj-footer-lang" defaultValue="ar">
              <option value="ar">العربية</option>
              <option value="en" disabled>English (قريبًا)</option>
              <option value="fr" disabled>Français (قريبًا)</option>
            </select>

            <a className="mj-footer-select mj-store-link" href="/download">
              <Ico name="download" />
              متاجر التطبيقات
            </a>

            <a className="mj-footer-select mj-store-link" href={APP_URL}>
              <Ico name="globeHalf" />
              app.majarra.app
            </a>
          </div>

          <div className="mj-footer-meta-group">
            <div className="mj-social">
              {SOCIAL_LINKS.map((social) => (
                <a href={social.href} aria-label={social.label} key={social.label}>
                  <Ico name={social.icon} />
                </a>
              ))}
            </div>
            <span className="mj-copyright">
              © {new Date().getFullYear()} مجرة · جميع الحقوق محفوظة
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
