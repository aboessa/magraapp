#!/usr/bin/env node
// Bulk import ALL 15 stories produced via PlayVeo Bulk API
// https://playveo.online/docs.json
// - a-calm-tale: 4 stories = 11 assets each
// - bedtime-stories: 6 stories = 15 assets each
// - qisas-min-alhayat: 5 stories = 19-23 assets each
// Total: 239 images + 234 audio
// Fixes: underline titles, missing thumbs, stories not uploaded (empty/0/0)
// Usage: node scripts/import-all-bulk-stories.mjs --dry-run

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const scriptDir = path.dirname(__filename)
const apiDir = path.resolve(scriptDir, '..')
const rootDir = path.resolve(apiDir, '..', '..')
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler')

const rawArgs = process.argv.slice(2)
const args = new Set(rawArgs)
const isRemote = args.has('--remote')
const dryRun = args.has('--dry-run')
const skipUpload = args.has('--skip-upload')
const targetFlag = isRemote ? '--remote' : '--local'
const envFlags = isRemote ? ['--env', 'production'] : []

if (args.has('--confirm-production') && !isRemote) throw new Error('--confirm-production only with --remote')
if (isRemote && !args.has('--confirm-production')) throw new Error('remote needs --confirm-production')

function sql(v){
  if(v===null||v===undefined) return 'NULL'
  if(typeof v==='number') return Number.isFinite(v) ? String(v) : 'NULL'
  if(typeof v==='boolean') return v? '1':'0'
  return `'${String(v).replaceAll("'", "''")}'`
}

function run(argv, opts={}){
  return new Promise((resolve, reject)=>{
    const child=spawn(wrangler, argv, { cwd: apiDir, stdio: opts.quiet?'pipe':'inherit', shell: process.platform==='win32' })
    let stderr=''
    if(opts.quiet) child.stderr?.on('data', c=> stderr+=c)
    child.on('error', reject)
    child.on('close', code=> code===0? resolve() : reject(new Error(`wrangler ${argv[0]} ${argv[1]} exited ${code}${stderr?`: ${stderr.slice(0,400)}`:''}`)))
  })
}

function wavDurationMs(buf){
  if(buf.length<44 || buf.toString('ascii',0,4)!=='RIFF') return null
  const byteRate=buf.readUInt32LE(28)
  if(!byteRate) return null
  const dataSize=buf.readUInt32LE(40)
  if(!dataSize) return null
  return Math.round((dataSize/byteRate)*1000)
}

async function readAsset(relativePath){
  const absolute=path.join(rootDir, relativePath)
  const data=await fs.readFile(absolute)
  const ext=path.extname(relativePath).toLowerCase()
  const mimeMap={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.m4a':'audio/mp4'}
  const mime=mimeMap[ext]||'application/octet-stream'
  const duration = ext==='.wav' ? wavDurationMs(data) : null
  return {
    absolute, relativePath, data,
    size: data.length,
    checksum: createHash('sha256').update(data).digest('hex'),
    mime,
    durationMs: duration,
    ext
  }
}

// Story definitions - using real series IDs from D1
const STORIES = [
  // a-calm-tale -> series-preschool-calm-tale
  { id: 'story-bird-home', slug: 'bird-home', seriesId: 'series-preschool-calm-tale', titleAr: 'بيت الطائر', titleEn: 'Bird Home', descAr: 'طائر صغير يطير بعيدا، ثم يعود الى عشه', type: 'picture_book', ageMin: 3, ageMax: 5, pages: 8, imageDir: 'app_main/assets/images/stories/act-s1-playveo', audioDir: 'assets/audio/stories/act-s1/ar', assetPrefix: 'act-s1' },
  { id: 'story-goodnight-toys', slug: 'goodnight-toys', seriesId: 'series-preschool-calm-tale', titleAr: 'تصبح على خير يا العاب', titleEn: 'Goodnight Toys', descAr: 'حكاية هادئة عن ترتيب الالعاب قبل النوم', type: 'picture_book', ageMin: 3, ageMax: 5, pages: 8, imageDir: 'app_main/assets/images/stories/act-s2-playveo', audioDir: 'assets/audio/stories/act-s2/ar', assetPrefix: 'act-s2' },
  { id: 'story-moon-sleeps', slug: 'moon-sleeps', seriesId: 'series-preschool-calm-tale', titleAr: 'القمر ينام', titleEn: 'Moon Sleeps', descAr: 'ادم وابوه يراقبان القمر الذي يستعد للنوم', type: 'picture_book', ageMin: 3, ageMax: 5, pages: 8, imageDir: 'app_main/assets/images/stories/act-s3-playveo', audioDir: 'assets/audio/stories/act-s3/ar', assetPrefix: 'act-s3' },
  { id: 'story-warm-hugs', slug: 'warm-hugs', seriesId: 'series-preschool-calm-tale', titleAr: 'احضان الدفء', titleEn: 'Warm Hugs', descAr: 'نور وجدتها تبحث عن بطانيتها الدافئة', type: 'picture_book', ageMin: 3, ageMax: 5, pages: 8, imageDir: 'app_main/assets/images/stories/act-s4-playveo', audioDir: 'assets/audio/stories/act-s4/ar', assetPrefix: 'act-s4' },
  // bedtime-stories -> series-kids-bedtime (real ID)
  { id: 'story-ant-journey', slug: 'ant-journey', seriesId: 'series-kids-bedtime', titleAr: 'رحلة النملة', titleEn: 'Ant Journey', descAr: 'نملة تحمل حبة اكبر منها، وتكتشف ان الطلب ليس ضعفا', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, imageDir: 'app_main/assets/images/stories/bs-s1-playveo', audioDir: 'assets/audio/stories/bs-s1/ar', assetPrefix: 'bs-s1' },
  { id: 'story-garden-secret', slug: 'garden-secret', seriesId: 'series-kids-bedtime', titleAr: 'سر الحدائق', titleEn: 'Garden Secret', descAr: 'بشير وجده يكتشفان كيف ينمو الزرع من الشقوق', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, imageDir: 'app_main/assets/images/stories/bs-s2-playveo', audioDir: 'assets/audio/stories/bs-s2/ar', assetPrefix: 'bs-s2' },
  { id: 'story-new-friend', slug: 'new-friend', seriesId: 'series-kids-bedtime', titleAr: 'صديق جديد', titleEn: 'New Friend', descAr: 'سامي ومازن يختلفان، ثم يجدان طريقة للعب معا', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, imageDir: 'app_main/assets/images/stories/bs-s3-playveo', audioDir: 'assets/audio/stories/bs-s3/ar', assetPrefix: 'bs-s3' },
  { id: 'story-rainy-night', slug: 'rainy-night', seriesId: 'series-kids-bedtime', titleAr: 'ليلة المطر', titleEn: 'Rainy Night', descAr: 'ليلى تسمع المطر، وامها تعلمها كيف تعد النجوم', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, imageDir: 'app_main/assets/images/stories/bs-s4-playveo', audioDir: 'assets/audio/stories/bs-s4/ar', assetPrefix: 'bs-s4' },
  { id: 'story-old-lantern', slug: 'old-lantern', seriesId: 'series-kids-bedtime', titleAr: 'الفانوس القديم', titleEn: 'Old Lantern', descAr: 'سلمى تجد فانوسا قديما وتتعلم ان الذكرى ليست في المعدن', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, imageDir: 'app_main/assets/images/stories/bs-s5-playveo', audioDir: 'assets/audio/stories/bs-s5/ar', assetPrefix: 'bs-s5' },
  { id: 'story-lost-star', slug: 'lost-star', seriesId: 'series-kids-bedtime', titleAr: 'نجمة تائهة', titleEn: 'Lost Star', descAr: 'نور ترى انعكاس نجمة في بركة وتظنها سقطت', type: 'picture_book', ageMin: 6, ageMax: 8, pages: 12, imageDir: 'app_main/assets/images/stories/bs-s6-playveo', audioDir: 'assets/audio/stories/bs-s6/ar', assetPrefix: 'bs-s6' },
  // qisas-min-alhayat junior 9-12 -> series-qisas-min-alhayat
  { id: 'story-promised-friday', slug: 'promised-friday', seriesId: 'series-qisas-min-alhayat', titleAr: 'الجمعة الموعودة', titleEn: 'Promised Friday', descAr: 'وعد قطع في الشتاء، واول ريح جاءت في اليوم الخطأ', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 18, imageDir: 'app_main/assets/images/stories/qml-the-promised-friday-playveo', audioDir: 'assets/audio/stories/qml-the-promised-friday/ar', assetPrefix: 'qml-promised-friday' },
  { id: 'story-nine-metres', slug: 'nine-metres', seriesId: 'series-qisas-min-alhayat', titleAr: 'تسعة أمتار', titleEn: 'Nine Metres', descAr: 'قالت رقما امام صفين، ثم جاء الشريط برقم اخر', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 18, imageDir: 'app_main/assets/images/stories/qml-nine-metres-playveo', audioDir: 'assets/audio/stories/qml-nine-metres/ar', assetPrefix: 'qml-nine-metres' },
  { id: 'story-taller-than-me', slug: 'taller-than-me', seriesId: 'series-qisas-min-alhayat', titleAr: 'اطول مني', titleEn: 'Taller Than Me', descAr: 'شريط قياس على الحائط يكشف فرقا لم يكن متوقعا', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 20, imageDir: 'app_main/assets/images/stories/qml-taller-than-me-playveo', audioDir: 'assets/audio/stories/qml-taller-than-me/ar', assetPrefix: 'qml-taller-than-me' },
  { id: 'story-key-left', slug: 'the-key-that-was-left', seriesId: 'series-qisas-min-alhayat', titleAr: 'المفتاح الذي بقي', titleEn: 'Key Left', descAr: 'مهمة لا يراها احد في مخزن المدرسة', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 16, imageDir: 'app_main/assets/images/stories/qml-the-key-that-was-left-playveo', audioDir: 'assets/audio/stories/qml-the-key-that-was-left/ar', assetPrefix: 'qml-key-left' },
  { id: 'story-extra-page', slug: 'extra-page', seriesId: 'series-qisas-min-alhayat', titleAr: 'الورقة الزائدة', titleEn: 'Extra Page', descAr: 'حقيقة يجب ان تقال، ولكن هل الان؟', type: 'picture_book', ageMin: 9, ageMax: 12, pages: 18, imageDir: 'app_main/assets/images/stories/qml-the-extra-page-playveo', audioDir: 'assets/audio/stories/qml-the-extra-page/ar', assetPrefix: 'qml-extra-page' },
];

async function main(){
  console.log(`Importing ${STORIES.length} stories – total pages expected: ${STORIES.reduce((a,s)=>a+s.pages,0)}`);
  const allRecords=[]
  const allStatements=[]

  for(const story of STORIES){
    console.log(`\n=== ${story.id} - ${story.titleAr} (${story.pages} pages) ===`);
    const records=[]
    // Check image dir exists
    const imageDirFull=path.join(rootDir, story.imageDir)
    try{
      await fs.access(imageDirFull)
    }catch{
      console.warn(`  skip – image dir not found ${story.imageDir}`)
      continue
    }

    // Collect page images
    for(let i=1;i<=story.pages;i++){
      const file=`page-${String(i).padStart(3,'0')}.jpg`
      const relPath=`${story.imageDir}/${file}`
      try{
        const asset=await readAsset(relPath)
        const assetId=`asset-${story.assetPrefix}-page-${String(i).padStart(3,'0')}`
        records.push({
          ...asset,
          id: assetId,
          kind: 'image',
          titleAr: `${story.titleAr} – الصفحة ${i}`,
          aspect: '16:9',
          language: null,
          page: i,
          purpose: 'page-image',
          visibility: 'public',
          bucket: 'thumbs',
          r2Key: `public/catalog/${relPath}`,
          relativePath: relPath
        })
      }catch(e){
        console.warn(`  missing image ${relPath}: ${e.message}`)
      }
    }

    // Cover/hero/thumb
    const covers=[
      { file: 'cover.jpg', role: 'cover', aspect: '1:1' },
      { file: 'hero.jpg', role: 'hero', aspect: '16:9' },
      { file: 'thumb.jpg', role: 'thumbnail', aspect: '3:4' },
    ]
    // Also check for webp versions? We prioritize jpg for D1 import, but CDR will serve webp via optimization
    for(const cov of covers){
      const relPath=`${story.imageDir}/${cov.file}`
      try{
        const asset=await readAsset(relPath)
        const assetId=`asset-${story.assetPrefix}-${cov.role==='thumbnail'?'thumb':cov.role}`
        records.push({
          ...asset,
          id: assetId,
          kind: 'image',
          titleAr: `${story.titleAr} – ${cov.role}`,
          aspect: cov.aspect,
          language: null,
          page: null,
          purpose: 'cover',
          role: cov.role,
          visibility: 'public',
          bucket: 'thumbs',
          r2Key: `public/catalog/${relPath}`,
          relativePath: relPath
        })
      }catch(e){
        console.warn(`  missing cover ${relPath}: ${e.message}`)
      }
    }

    // Audio – Arabic only for now, but check existence
    const audioDirFull=path.join(rootDir, story.audioDir)
    try{
      await fs.access(audioDirFull)
      const files=await fs.readdir(audioDirFull)
      const wavFiles=files.filter(f=> f.endsWith('-ar.wav') || f.endsWith('.wav')).sort()
      for(const f of wavFiles.slice(0, story.pages)){
        const relPath=`${story.audioDir}/${f}`
        try{
          const asset=await readAsset(relPath)
          // Try to parse page number from filename page-001-ar.wav
          const m=f.match(/page-(\d+)/)
          const pageNum=m? parseInt(m[1]): null
          const assetId=`asset-${story.assetPrefix}-vo-ar-${String(pageNum||1).padStart(3,'0')}`
          records.push({
            ...asset,
            id: assetId,
            kind: 'audio',
            titleAr: `سرد ${story.titleAr} – الصفحة ${pageNum}`,
            aspect: null,
            language: 'ar',
            page: pageNum,
            purpose: 'narration',
            visibility: 'public', // narration is public for free stories
            bucket: 'thumbs',
            r2Key: `public/catalog/${relPath}`,
            relativePath: relPath
          })
        }catch(e){
          console.warn(`  missing audio ${relPath}: ${e.message}`)
        }
      }
    }catch{
      console.log(`  no audio dir ${story.audioDir}`)
    }

    console.log(`  collected ${records.length} assets (${records.filter(r=>r.kind==='image').length} images, ${records.filter(r=>r.kind==='audio').length} audio)`)

    // Build D1 statements for this story
    for(const rec of records){
      const meta={
        story: story.id,
        purpose: rec.purpose,
        ...(rec.page?{page:rec.page}:{}),
        ...(rec.durationMs?{duration_ms:rec.durationMs}:{}),
        source_manifest: `bulk-generated via PlayVeo nano_banana_2 ${story.assetPrefix}`
      }
      allStatements.push(`
INSERT INTO content_assets (
  id, title_ar, kind, source, status, original_filename, expected_path, r2_key, bucket,
  mime_type, size_bytes, checksum_sha256, visibility, language, aspect_ratio, metadata, uploaded_by, updated_at
) VALUES (
  ${sql(rec.id)}, ${sql(rec.titleAr)}, ${sql(rec.kind)}, 'generated', 'ready',
  ${sql(path.basename(rec.relativePath))}, ${sql(rec.relativePath)}, ${sql(rec.r2Key)}, ${sql(rec.bucket)},
  ${sql(rec.mime)}, ${sql(rec.size)}, ${sql(rec.checksum)}, ${sql(rec.visibility)},
  ${sql(rec.language)}, ${sql(rec.aspect)}, ${sql(JSON.stringify(meta))}, 'bulk-import-all-stories', datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  title_ar = excluded.title_ar, status = excluded.status, r2_key = excluded.r2_key,
  bucket = excluded.bucket, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
  checksum_sha256 = excluded.checksum_sha256, visibility = excluded.visibility,
  language = excluded.language, aspect_ratio = excluded.aspect_ratio, metadata = excluded.metadata,
  updated_at = datetime('now');`)
    }

    // Story itself – use ON CONFLICT(slug) only, as slug is the true unique key and ON CONFLICT(id) would miss slug conflicts
    // The id in our bulk is derived from slug (story-{slug}), so updating by slug is safe
    allStatements.push(`
INSERT INTO stories (
  id, series_id, slug, title_ar, title_en, description_ar, type, age_min, age_max,
  reading_level, interaction_mode, supervision_level, default_language, languages,
  status, is_free, price_tier, sort_order, updated_at
) VALUES (
  ${sql(story.id)}, ${sql(story.seriesId)}, ${sql(story.slug)}, ${sql(story.titleAr)}, ${sql(story.titleEn)},
  ${sql(story.descAr)}, ${sql(story.type)}, ${story.ageMin}, ${story.ageMax},
  'independent', 'tap', 'none', 'ar', '["ar"]',
  'ready', 1, 'free', 1, datetime('now')
)
ON CONFLICT(slug) DO UPDATE SET
  id = excluded.id,
  series_id = excluded.series_id,
  title_ar = excluded.title_ar, title_en = excluded.title_en,
  description_ar = excluded.description_ar,
  type = excluded.type, age_min = excluded.age_min, age_max = excluded.age_max,
  status = excluded.status, is_free = excluded.is_free, updated_at = datetime('now');`)

    // Pages
    for(let i=1;i<=story.pages;i++){
      const pageId=`page-${story.slug}-${String(i).padStart(3,'0')}`
      const imageId=`asset-${story.assetPrefix}-page-${String(i).padStart(3,'0')}`
      allStatements.push(`
INSERT INTO story_pages (id, story_id, page_number, layout, image_asset_id, duration_ms, transition, sort_order, updated_at)
VALUES (${sql(pageId)}, ${sql(story.id)}, ${i}, 'full_bleed', ${sql(imageId)}, 8000, 'kenburns_slow', ${i}, datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  image_asset_id = excluded.image_asset_id, duration_ms = excluded.duration_ms,
  transition = excluded.transition, layout = excluded.layout, updated_at = datetime('now');`)

      // Localization – read actual text from bundled json if exists
      let bodyText = `${story.titleAr} - صفحة ${i}`
      try{
        const bundledPath=path.join(rootDir, `app_main/assets/data/bundled_stories/${story.id}.json`)
        const bundled=JSON.parse(await fs.readFile(bundledPath,'utf8'))
        const pageData=bundled.data?.find(p=> p.page_number===i)
        if(pageData?.body_text) bodyText=pageData.body_text
      }catch{}

      const narrationId=`asset-${story.assetPrefix}-vo-ar-${String(i).padStart(3,'0')}`
      allStatements.push(`
INSERT INTO story_page_localizations (page_id, language, body_text, alt_text, narration_asset_id, updated_at)
VALUES (${sql(pageId)}, 'ar', ${sql(bodyText)}, ${sql(`${story.titleAr} صفحة ${i}`)}, ${sql(narrationId)}, datetime('now'))
ON CONFLICT(page_id, language) DO UPDATE SET
  body_text = excluded.body_text, alt_text = excluded.alt_text,
  narration_asset_id = excluded.narration_asset_id, updated_at = datetime('now');`)
    }

    // Asset links for cover/hero/thumb
    for(const cov of covers){
      const role=cov.role
      const assetId=`asset-${story.assetPrefix}-${role==='thumbnail'?'thumb':role}`
      allStatements.push(`
INSERT INTO asset_links (id, asset_id, entity_type, entity_id, role, sort_order)
VALUES (${sql(`link-${story.assetPrefix}-${role}`)}, ${sql(assetId)}, 'story', ${sql(story.id)}, ${sql(role)}, 0)
ON CONFLICT(id) DO UPDATE SET asset_id = excluded.asset_id, role = excluded.role;`)
    }

    allRecords.push(...records)
  }

  console.log(`\nTotal assets: ${allRecords.length} (${allRecords.filter(r=>r.kind==='image').length} images, ${allRecords.filter(r=>r.kind==='audio').length} audio)`)
  console.log(`Total D1 statements: ${allStatements.length}`)

  if(dryRun){
    for(const rec of allRecords.slice(0,20)){
      console.log(`  ${rec.id.padEnd(35)} ${String(rec.size).padStart(8)}B ${rec.r2Key}`)
    }
    if(allRecords.length>20) console.log(`  ... and ${allRecords.length-20} more`)
    console.log('\ndry run: nothing written')
    return
  }

  if(!skipUpload){
    const bucketName='majarra-thumbs'
    let done=0
    for(const rec of allRecords){
      try{
        await run([
          'r2','object','put', `${bucketName}/${rec.r2Key}`,
          `--file=${rec.absolute}`,
          `--content-type=${rec.mime}`,
          ...(isRemote? ['--remote']: ['--local'])
        ], { quiet: true })
      }catch(e){
        console.error(`  upload failed ${rec.r2Key}: ${e.message}`)
        continue
      }
      done++
      if(done%10===0 || done===allRecords.length) console.log(`  uploaded ${done}/${allRecords.length}`)
    }
  }

  // Write SQL file and execute
  const tempDir=path.join(apiDir, '.tmp')
  await fs.mkdir(tempDir,{recursive:true})
  const sqlPath=path.join(tempDir, 'import-all-bulk-stories.sql')
  await fs.writeFile(sqlPath, allStatements.join('\n'), 'utf8')
  try{
    await run(['d1','execute','majarra-db', targetFlag, ...envFlags, `--file=${sqlPath}`])
  }finally{
    await fs.rm(sqlPath,{force:true})
  }

  // Audit log
  const auditSql=`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES ('audit-bulk-${Date.now()}', 'bulk-import-all-stories', 'bulk_import', 'stories', 'all-15', '${JSON.stringify({ assets: allRecords.length, stories: STORIES.length, target: isRemote?'remote':'local' }).replaceAll("'", "''")}');`
  const auditPath=path.join(tempDir, 'audit.sql')
  await fs.writeFile(auditPath, auditSql, 'utf8')
  try{
    await run(['d1','execute','majarra-db', targetFlag, ...envFlags, `--file=${auditPath}`])
  }catch{} finally {
    await fs.rm(auditPath,{force:true})
  }

  console.log(`\nImported ${allRecords.length} assets, ${STORIES.length} stories, ${STORIES.reduce((a,s)=>a+s.pages,0)} pages`)
}

await main()
