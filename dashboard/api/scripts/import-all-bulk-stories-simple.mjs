#!/usr/bin/env node
// Simple import for production - only stories + pages, no assets (assets already in R2 from previous local upload? Actually we need assets too)
// We will do it story by story with small files

import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const scriptDir = path.dirname(__filename)
const apiDir = path.resolve(scriptDir, '..')
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform==='win32'?'wrangler.cmd':'wrangler')

function sql(v){
  if(v===null||v===undefined) return 'NULL'
  if(typeof v==='number') return Number.isFinite(v) ? String(v) : 'NULL'
  if(typeof v==='boolean') return v? '1':'0'
  return `'${String(v).replaceAll("'", "''")}'`
}

function run(argv){
  return new Promise((resolve, reject)=>{
    const child=spawn(wrangler, argv, { cwd: apiDir, stdio: 'pipe', shell: process.platform==='win32' })
    let out='', err=''
    child.stdout?.on('data', c=> out+=c)
    child.stderr?.on('data', c=> err+=c)
    child.on('close', code=> code===0? resolve({out, err}) : reject(new Error(`wrangler ${argv.join(' ')} exited ${code}: ${err.slice(0,1000)}`)))
  })
}

const STORIES = [
  { id: 'story-bird-home', slug: 'bird-home', seriesId: 'series-preschool-calm-tale', titleAr: 'بيت الطائر', titleEn: 'Bird Home', descAr: 'طائر صغير يطير بعيدا ثم يعود الى عشه', type: 'picture_book', ageMin: 3, ageMax: 5, pages: 8, assetPrefix: 'act-s1' },
  { id: 'story-goodnight-toys', slug: 'goodnight-toys', seriesId: 'series-preschool-calm-tale', titleAr: 'تصبح على خير يا العابي', titleEn: 'Goodnight Toys', descAr: 'حكاية هادئة عن ترتيب الالعاب قبل النوم', type: 'picture_book', ageMin: 3, ageMax: 5, pages: 8, assetPrefix: 'act-s2' },
  { id: 'story-moon-sleeps', slug: 'moon-sleeps', seriesId: 'series-preschool-calm-tale', titleAr: 'القمر ينام', titleEn: 'Moon Sleeps', descAr: 'ادم وابوه يراقبان القمر الذي يستعد للنوم', type: 'picture_book', ageMin: 3, ageMax: 5, pages: 8, assetPrefix: 'act-s3' },
  { id: 'story-warm-hugs', slug: 'warm-hugs', seriesId: 'series-preschool-calm-tale', titleAr: 'احضان الدفء', titleEn: 'Warm Hugs', descAr: 'نور وجدتها تبحث عن بطانيتها الدافئة', type: 'picture_book', ageMin: 3, ageMax: 5, pages: 8, assetPrefix: 'act-s4' },
  { id: 'story-ant-journey', slug: 'ant-journey', seriesId: 'series-kids-bedtime', titleAr: 'رحلة النملة', titleEn: 'Ant Journey', descAr: 'نملة تحمل حبة اكبر منها', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, assetPrefix: 'bs-s1' },
  { id: 'story-garden-secret', slug: 'garden-secret', seriesId: 'series-kids-bedtime', titleAr: 'سر الحدائق', titleEn: 'Garden Secret', descAr: 'بشير وجده يكتشفان كيف ينمو الزرع', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, assetPrefix: 'bs-s2' },
  { id: 'story-new-friend', slug: 'new-friend', seriesId: 'series-kids-bedtime', titleAr: 'صديق جديد', titleEn: 'New Friend', descAr: 'سامي ومازن يختلفان ثم يجدان طريقة للعب معا', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, assetPrefix: 'bs-s3' },
  { id: 'story-rainy-night', slug: 'rainy-night', seriesId: 'series-kids-bedtime', titleAr: 'ليلة المطر', titleEn: 'Rainy Night', descAr: 'ليلى تسمع المطر', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, assetPrefix: 'bs-s4' },
  { id: 'story-old-lantern', slug: 'old-lantern', seriesId: 'series-kids-bedtime', titleAr: 'الفانوس القديم', titleEn: 'Old Lantern', descAr: 'سلمى تجد فانوسا قديما', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, assetPrefix: 'bs-s5' },
  { id: 'story-lost-star', slug: 'lost-star', seriesId: 'series-kids-bedtime', titleAr: 'نجمة تائهة', titleEn: 'Lost Star', descAr: 'نور ترى انعكاس نجمة في بركة', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, assetPrefix: 'bs-s6' },
  { id: 'story-promised-friday', slug: 'promised-friday', seriesId: 'series-qisas-min-alhayat', titleAr: 'الجمعة الموعودة', titleEn: 'Promised Friday', descAr: 'وعد قطع في الشتاء', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 18, assetPrefix: 'qml-promised-friday' },
  { id: 'story-nine-metres', slug: 'nine-metres', seriesId: 'series-qisas-min-alhayat', titleAr: 'تسعة أمتار', titleEn: 'Nine Metres', descAr: 'قالت رقما امام صفين', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 18, assetPrefix: 'qml-nine-metres' },
  { id: 'story-taller-than-me', slug: 'taller-than-me', seriesId: 'series-qisas-min-alhayat', titleAr: 'اطول مني', titleEn: 'Taller Than Me', descAr: 'شريط قياس على الحائط', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 20, assetPrefix: 'qml-taller-than-me' },
  { id: 'story-key-left', slug: 'the-key-that-was-left', seriesId: 'series-qisas-min-alhayat', titleAr: 'المفتاح الذي بقي', titleEn: 'Key Left', descAr: 'مهمة لا يراها احد', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 16, assetPrefix: 'qml-key-left' },
  { id: 'story-extra-page', slug: 'extra-page', seriesId: 'series-qisas-min-alhayat', titleAr: 'الورقة الزائدة', titleEn: 'Extra Page', descAr: 'حقيقة يجب ان تقال', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 18, assetPrefix: 'qml-extra-page' },
];

async function main(){
  const isRemote=true
  const targetFlag='--remote'
  const envFlags=['--env','production']

  // Phase 1: stories only
  console.log('Phase 1: stories');
  let statements=[]
  for(const s of STORIES){
    statements.push(`INSERT INTO stories (id, series_id, slug, title_ar, title_en, description_ar, type, age_min, age_max, reading_level, interaction_mode, supervision_level, default_language, languages, status, is_free, price_tier, sort_order, updated_at) VALUES (${sql(s.id)}, ${sql(s.seriesId)}, ${sql(s.slug)}, ${sql(s.titleAr)}, ${sql(s.titleEn)}, ${sql(s.descAr)}, ${sql(s.type)}, ${s.ageMin}, ${s.ageMax}, 'independent', 'tap', 'none', 'ar', '["ar"]', 'published', 1, 'free', 1, datetime('now')) ON CONFLICT(slug) DO UPDATE SET title_ar=excluded.title_ar, title_en=excluded.title_en, description_ar=excluded.description_ar, status='published', updated_at=datetime('now');`);
  }
  const tempDir=path.join(apiDir, '.tmp')
  await fs.mkdir(tempDir,{recursive:true})
  const file1=path.join(tempDir, 'prod_stories_only.sql')
  await fs.writeFile(file1, statements.join('\n'), 'utf8')
  await run(['d1','execute','majarra-db', targetFlag, ...envFlags, `--file=${file1}`])
  console.log('Phase 1 done: stories published');

  // Phase 2: pages (without image_asset_id FK to avoid constraint, will update later)
  console.log('Phase 2: pages');
  statements=[]
  for(const s of STORIES){
    for(let i=1;i<=s.pages;i++){
      const pageId=`page-${s.slug}-${String(i).padStart(3,'0')}`
      statements.push(`INSERT INTO story_pages (id, story_id, page_number, layout, duration_ms, transition, sort_order, updated_at) VALUES (${sql(pageId)}, ${sql(s.id)}, ${i}, 'full_bleed', 8000, 'kenburns_slow', ${i}, datetime('now')) ON CONFLICT(id) DO UPDATE SET duration_ms=excluded.duration_ms, updated_at=datetime('now');`);
    }
  }
  const file2=path.join(tempDir, 'prod_pages_only.sql')
  await fs.writeFile(file2, statements.join('\n'), 'utf8')
  await run(['d1','execute','majarra-db', targetFlag, ...envFlags, `--file=${file2}`])
  console.log(`Phase 2 done: ${STORIES.reduce((a,s)=>a+s.pages,0)} pages`);

  // Phase 3: localizations with body_text from bundled JSON
  console.log('Phase 3: localizations');
  statements=[]
  const rootDir=path.resolve(apiDir, '..', '..')
  for(const s of STORIES){
    let bundledData=null
    try{
      const bundledPath=path.join(rootDir, `app_main/assets/data/bundled_stories/${s.id}.json`)
      bundledData=JSON.parse(await fs.readFile(bundledPath,'utf8'))
    }catch{}
    for(let i=1;i<=s.pages;i++){
      const pageId=`page-${s.slug}-${String(i).padStart(3,'0')}`
      let bodyText=`${s.titleAr} - صفحة ${i}`
      if(bundledData){
        const page=bundledData.data?.find(p=> p.page_number===i)
        if(page?.body_text) bodyText=page.body_text
      }
      statements.push(`INSERT INTO story_page_localizations (page_id, language, body_text, alt_text, updated_at) VALUES (${sql(pageId)}, 'ar', ${sql(bodyText)}, ${sql(`${s.titleAr} صفحة ${i}`)}, datetime('now')) ON CONFLICT(page_id, language) DO UPDATE SET body_text=excluded.body_text, updated_at=datetime('now');`);
    }
  }
  const file3=path.join(tempDir, 'prod_localizations.sql')
  await fs.writeFile(file3, statements.join('\n'), 'utf8')
  await run(['d1','execute','majarra-db', targetFlag, ...envFlags, `--file=${file3}`])
  console.log('Phase 3 done: localizations');

  console.log('\nAll done – stories should now show as published with pages, but without images (images need R2 assets phase which had syntax error before)');
  console.log('Run: SELECT id, slug, title_ar, status, (SELECT COUNT(*) FROM story_pages WHERE story_id=stories.id) as pages FROM stories WHERE status=\"published\" ORDER BY slug');
}

await main()
