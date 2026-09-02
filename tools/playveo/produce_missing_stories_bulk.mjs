#!/usr/bin/env node
/**
 * Majarra – Produce ALL missing illustrated stories in BULK (10 at once)
 * Uses POST /v1/images/bulk/text-to-image as per https://playveo.online/docs.json
 * Models: nano_banana_2 (illustrated), reference: gen_act_s4_bulk.mjs + generate_all_stories_bulk.mjs
 *
 * Missing stories:
 * - act-s4 (أحضان الدفء) remaining 4 pages (we have 7/11 already)
 * - bs-s1..bs-s6 (bedtime stories) 6 x 15 = 90 assets
 *
 * Flow per docs.json critical_rules:
 * 1. Validate every prompt non-empty + unique normalized (client-side)
 * 2. Group by aspect_ratio, chunk by BULK_LIMIT=10 (Pro) or 5 (Free)
 * 3. POST /bulk, persist returned ids immediately
 * 4. Poll each id independently GET /v1/images/{id} every 5s until completed/failed
 * 5. Download + verify JPEG, mirror to app_main/assets/images/stories/{story}-playveo/
 * 6. Final step: convert to WebP via prepare-* scripts
 *
 * Usage:
 *   node tools/playveo/produce_missing_stories_bulk.mjs --dry           # no billing
 *   node tools/playveo/produce_missing_stories_bulk.mjs --story act-s4  # only this story
 *   node tools/playveo/produce_missing_stories_bulk.mjs --submit        # submit + poll all missing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..','..');
const BASE_URL = 'https://playveo-api.aboessa101.workers.dev';
const MODEL = 'nano_banana_2';
const BULK_LIMIT = 5; // detected from API: Maximum 5 for current plan (free). Docs says 10 Pro, 20 Enterprise, so keep 5 safe and auto fallback on 400.
const POLL_INTERVAL = 5000;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ONLY_STORY = (()=>{const i=args.indexOf('--story'); return i!==-1 ? args[i+1] : null;})();
const VERBOSE = args.includes('--verbose');

function parseEnv(filePath, name) {
  if (!fs.existsSync(filePath)) return undefined;
  for (const line of fs.readFileSync(filePath,'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1]!==name) continue;
    let v=m[2].trim();
    if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    return v.trim();
  }
}
function loadKey() {
  const c = [
    process.env.PLAYVEO_API_KEY?.trim(),
    parseEnv(path.join(ROOT,'.env.local'),'PLAYVEO_API_KEY'),
    parseEnv(path.join(ROOT,'dashboard','api','.dev.vars'),'PLAYVEO_API_KEY'),
    parseEnv(path.join(ROOT,'.env'),'PLAYVEO_API_KEY'),
  ];
  return c.find(x=>x && x.length>8);
}
const API_KEY = DRY ? 'dry-key' : loadKey();
if (!API_KEY && !DRY) {
  console.error('❌ PLAYVEO_API_KEY not found in dashboard/api/.dev.vars or env');
  process.exit(1);
}
console.log(`🔑 key ${DRY?'dry-run': API_KEY.slice(0,10)+'***'} | model=${MODEL} | bulk=${BULK_LIMIT} | dry=${DRY}`);

const STATE_PATH = path.join(__dirname, '.produce-missing-bulk-state.json');
function loadState() { return fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH,'utf8')) : { at:new Date().toISOString(), stories:{}, batches:[] }; }
function saveState(s){ s.updated_at=new Date().toISOString(); fs.writeFileSync(STATE_PATH, JSON.stringify(s,null,2)+'\n'); }

function normalizePrompt(p){ return p.trim().toLowerCase().replace(/\s+/g,' '); }
function buildPrompt(manifest, asset) {
  const lock = manifest.character_lock ? manifest.character_lock+' ' : '';
  const scene = asset.scene + ' ';
  const light = asset.light ? asset.light+' ' : '';
  const tail = manifest.style_tail||'';
  return (lock+scene+light+tail).replace(/\s+/g,' ').trim();
}
async function fetchWithTimeout(url,opts={}){ return fetch(url,{...opts, signal:AbortSignal.timeout(opts.timeout ?? 120_000)}); }

async function bulkPost(prompts, aspect) {
  if (!prompts.length) throw new Error('empty bulk');
  if (prompts.length > BULK_LIMIT) throw new Error(`bulk over limit ${prompts.length}>${BULK_LIMIT} per detected plan`);
  for (const p of prompts) if (!p?.trim()) throw new Error('empty prompt in bulk per docs.json');
  const norm = prompts.map(normalizePrompt);
  const seen = new Set();
  for (const n of norm) { if (seen.has(n)) throw new Error(`Duplicate normalized prompt blocked before billing: ${n.slice(0,100)}`); seen.add(n); }
  console.log(`\n📦 BULK POST ${prompts.length}x aspect=${aspect}`);
  if (DRY) return prompts.map((_,i)=>({ id:`dry-job-${Date.now()}-${i}`, creditCost:0, prompt:prompts[i]}));
  const attemptOnce = async (chunk) => {
    const res = await fetchWithTimeout(`${BASE_URL}/v1/images/bulk/text-to-image`, {
      method:'POST',
      headers:{ Authorization:`Bearer ${API_KEY}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ prompts: chunk, aspect_ratio: aspect, model: MODEL }),
      timeout: 120_000
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`bulk ${res.status} ${txt.slice(0,1000)}`);
    let j; try{ j=JSON.parse(txt); }catch{ throw new Error('bulk not json '+txt.slice(0,400)); }
    const jobs = j.jobs||[];
    if (!jobs.length) throw new Error('bulk returned no jobs '+txt.slice(0,600));
    const state = loadState();
    state.batches.push({ at:new Date().toISOString(), aspect, count:chunk.length, prompts: chunk, jobs, totalCost:j.totalCost, remainingCredits:j.remainingCredits });
    state.at = new Date().toISOString();
    saveState(state);
    console.log(`✅ accepted ${jobs.length} jobs totalCost=${j.totalCost} remaining=${j.remainingCredits ?? '?'}`);
    return jobs.map((job, idx)=>({ id: typeof job==='string'?job: job.id||job.job_id||'', creditCost: job.creditCost, raw:job, prompt:chunk[idx]} )).filter(x=>x.id);
  };
  try {
    return await attemptOnce(prompts);
  } catch(e) {
    // Auto fallback if server still says max 5 but we sent 5 already, the error might be plan downgrade – re-throw with hint
    if (String(e.message).includes('Maximum 5') && prompts.length>5) {
      console.warn('↩️ Fallback: splitting to 5');
      const all=[];
      for (let i=0;i<prompts.length;i+=5) {
        const sub = prompts.slice(i,i+5);
        const subJobs = await attemptOnce(sub);
        all.push(...subJobs);
        await new Promise(r=>setTimeout(r,800));
      }
      return all;
    }
    throw e;
  }
}

async function waitImage(id, timeoutMs=12*60*1000) {
  if (DRY) return { status:'completed', resultUrls:[`https://example.com/${id}.jpg`], result_urls:[`https://example.com/${id}.jpg`] } ;
  const start=Date.now();
  let last='';
  while (Date.now()-start < timeoutMs) {
    await new Promise(r=>setTimeout(r, POLL_INTERVAL));
    const res = await fetchWithTimeout(`${BASE_URL}/v1/images/${id}`, { headers:{ Authorization:`Bearer ${API_KEY}` }, timeout:30_000 });
    const txt = await res.text();
    if (!res.ok) { console.log(` ⏳ ${id.slice(0,8)} GET ${res.status} retry`); continue; }
    let j; try{ j=JSON.parse(txt); }catch{ console.log(` ⏳ ${id.slice(0,8)} bad json`); continue; }
    const inner = j.image || j;
    const st = (inner.status||'').toLowerCase();
    if (st!==last) { console.log(` ⏳ ${id.slice(0,8)} ${st} ${Math.round((Date.now()-start)/1000)}s`); last=st; }
    if (st==='completed' || st==='ready') return inner;
    if (st==='failed') throw new Error(`job ${id} failed ${inner.error||''} ${JSON.stringify(inner).slice(0,600)}`);
  }
  throw new Error(`timeout ${id}`);
}

async function downloadImage(url, destAbs) {
  if (DRY) { fs.mkdirSync(path.dirname(destAbs),{recursive:true}); fs.writeFileSync(destAbs, Buffer.from('dry')); return 3; }
  const r = await fetchWithTimeout(url, { timeout:60_000 });
  if (!r.ok) throw new Error(`download ${r.status} ${url.slice(0,120)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const isJpg = buf[0]===0xFF && buf[1]===0xD8;
  const isPng = buf[0]===0x89 && buf[1]===0x50;
  if (!isJpg && !isPng) console.warn(`⚠️ not jpg/png magic=${buf.slice(0,8).toString('hex')} file=${destAbs}`);
  fs.mkdirSync(path.dirname(destAbs),{recursive:true});
  fs.writeFileSync(destAbs, buf);
  return buf.length;
}

// ---- Bedtime stories definitions reused from generate_all_stories_bulk.mjs but concise ----
const BS_STORIES = [
  {
    story: 'bs-s1',
    title: 'رحلة النملة',
    character_lock: 'Same small friendly round-edged ant character in every image: warm amber tiny body, large friendly dark gentle eyes, soft rounded limbs, no sharp mandibles, no frightening insect detail, never crying or collapsed. She is the only ant until page 8 when caravan appears. Grain seed clearly larger than ant. Nature ground with tiny stones and grass blades.',
    style_tail: " Premium soft 2D kids bedtime storybook illustration, rounded clean shapes, gentle dimensional shading, warm cream, muted sage, soft gold and terracotta palette, full-bleed to all four edges, natively composed for 16:9 with no baked black bars. Calm low-stimulation composition with only named main elements, child-safe and emotionally reassuring. For every 16:9 page keep all ant, seed, slope and story action inside central 90 percent safe area. No text, no letters, no numbers, no logo, no watermark, no frame, no speech bubble, no scary insect, no frightening expression, no clutter, no complete darkness, no celebration confetti. No burnt-in text.",
    scenes: [
      { file:'page-001.jpg', aspect_ratio:'16:9', brightness:1.0, motion:'kenburns_slow', scene:'Wide nature ground view at base of large tree root. Tiny amber friendly round-edged ant with gentle eyes stands near tree root entrance, warm daylight. Four elements max.', light:'Bright warm midday daylight, clear light blue sky, brightest page, fully readable, no stars, no moon.' },
      { file:'page-002.jpg', aspect_ratio:'16:9', brightness:0.98, motion:'kenburns_slow', scene:'Medium nature view. Tiny amber ant beside single large grain seed clearly three times bigger than ant body, size difference obvious. Seed as focal object beside ant.', light:'Warm daylight, slightly softer than page1, fully readable, no darkness.' },
      { file:'page-003.jpg', aspect_ratio:'16:9', brightness:0.96, motion:'pan_slow', scene:'Ant carries same grain seed on back walking on flat even ground with tiny grass blades, calm practical movement. Flat ground clearly even.', light:'Soft warm daylight, readable, flat even ground well lit.' },
      { file:'page-004.jpg', aspect_ratio:'16:9', brightness:0.94, motion:'pan_slow', scene:'Clear visible inclined slope - ground becomes slanted upward toward top. Same ant and seed at base of slope looking up. The slope incline must be visually obvious as the new word.', light:'Warm daylight, slope texture clearly visible and distinct, no fear, no darkness.' },
      { file:'page-005.jpg', aspect_ratio:'16:9', brightness:0.92, motion:'pan_slow', scene:'Climax small. Same ant pushes seed up slope, seed sliding down. Ant neutral calm face, no frowning tragedy expression, no crying, no despair. Sliding is an event not a tragedy.', light:'Daylight, still bright, sliding moment clear but calm, no dramatic shadow.' },
      { file:'page-006.jpg', aspect_ratio:'16:9', brightness:0.9, motion:'kenburns_slow', scene:'Same ant pushes seed with more effort second time, seed slides again, ant still not crying, no despair collapse, just trying and observing.', light:'Warm daylight dimming slightly, readable, no frustration dramatization.' },
      { file:'page-007.jpg', aspect_ratio:'16:9', brightness:0.88, motion:'kenburns_slow', scene:'MOST IMPORTANT IMAGE: ant sitting calmly looking at slope, thinking pose, hand near head optional but no human gesture. Quiet thinking moment understanding that seed is not heavy but road is inclined. Minimal calm composition.', light:'Soft golden evening beginning, warm and reassuring, ant thinking pose well lit.' },
      { file:'page-008.jpg', aspect_ratio:'16:9', brightness:0.86, motion:'kenburns_slow', scene:'Near by small line of three ants in single file caravan formation, tiny amber friendly ants in a row clearly showing caravan word. Original ant looking and calling them calmly with decision not distress.', light:'Warm evening light, caravan clearly visible and countable as three ants in line.' },
      { file:'page-009.jpg', aspect_ratio:'16:9', brightness:0.83, motion:'kenburns_slow', scene:'Four ants together pushing same grain seed up inclined slope calmly cooperatively, seed moving up slope quietly. All four ants same friendly round style.', light:'Warm early-evening, cooperative pushing, all ants and seed inside safe area.' },
      { file:'page-010.jpg', aspect_ratio:'16:9', brightness:0.8, motion:'kenburns_slow', scene:'Seed now at house entrance door at base of tree root. Four ants near entrance, one ant giving thanks with gentle closed-mouth smile. No celebration, no clapping, no confetti, just quiet thanking.', light:'Soft evening, gentle lamp glow starting, calm settled.' },
      { file:'page-011.jpg', aspect_ratio:'16:9', brightness:0.75, motion:'static', scene:'Static quiet scene: four ants sitting together near house door, evening calm. Soft pale crescent moon clearly visible in sky as mandatory light source. All ants calm seated, no extra action.', light:'Calm blue twilight balanced by warm soft lamp glow, moon clearly visible, dim but readable, never dark.' },
      { file:'page-012.jpg', aspect_ratio:'16:9', brightness:0.7, motion:'static', scene:'Final still calm scene: house entrance and quiet moonlit sky. Ant sleeping peacefully in corner near entrance, moonlight. No mention of difficulty, just still sleeping. No event, serene.', light:'Dimmest scene: soft blue moonlight plus faint warm glow, never fully dark, readable and reassuring.' },
      { file:'cover.jpg', aspect_ratio:'1:1', scene:'Square cover: tiny friendly amber ant beside large grain seed near tree root, centered calm composition, upper area clean for title layer.', light:'Warm daylight, inviting, readable.' },
      { file:'hero.jpg', aspect_ratio:'16:9', scene:'Wide cinematic: tiny ant pushing seed up gentle slope with three caravan ants behind helping. Right forty percent calm darker empty for Arabic title overlay. No embedded title.', light:'Warm to blue evening gradient, calm low contrast.' },
      { file:'thumb.jpg', aspect_ratio:'3:4', scene:'Vertical: tall composition with ant and seed central, caravan ants below, moon above, strong readable silhouettes small size, upper quarter clean for title.', light:'Soft twilight blue with warm lamp, comforting.' },
    ]
  },
  {
    story: 'bs-s2',
    title: 'سر الحدائق',
    character_lock: 'Bashir is same seven-year-old Arab boy in every image: warm medium skin, dark brown short wavy hair, large dark friendly eyes, childlike proportions, wearing muted sage long-sleeve shirt and cream trousers. Grandfather is same gentle older Arab man in his sixties: warm skin, kind dark eyes, short white beard trimmed, wearing plain light-beige thobe without decoration. Stone wall consistent old irregular stones with visible crack.',
    style_tail: " Premium soft 2D kids illustrated storybook, rounded shapes, gentle shading, warm cream, sage, soft stone gray and gold palette, full-bleed native 16:9, no baked bars, calm low-stimulation, child-safe reassuring, keep faces and story action inside central 90%, no text, no letters, no numbers, no logo, no watermark, no frame, no speech bubble, no scary expression, no clutter, no complete darkness, no storm.",
    scenes: [
      { file:'page-001.jpg', aspect_ratio:'16:9', brightness:1.0, motion:'kenburns_slow', scene:'Wide small garden view. Seven-year-old boy sitting on low step near small garden, grandfather figure in background sitting on veranda chair calmly. Warm daylight. Four groups max.', light:'Bright warm daylight, brightest page, clear blue sky, fully readable.' },
      { file:'page-002.jpg', aspect_ratio:'16:9', brightness:0.98, motion:'kenburns_slow', scene:'Medium view old irregular stone wall in garden, no people close, wall texture prominent natural stones.', light:'Warm daylight, wall clearly visible stone texture, readable.' },
      { file:'page-003.jpg', aspect_ratio:'16:9', brightness:0.96, motion:'pan_slow', scene:'Close-up stone wall crack with tiny green seedling emerging from crack, word crack clearly visible from image. Small plant growing from stone, green bright.', light:'Warm daylight focus on crack and seedling, vibrant green highlight.' },
      { file:'page-004.jpg', aspect_ratio:'16:9', brightness:0.94, motion:'pan_slow', scene:'Boy near stone wall looking closely at seedling, no soil visible around seedling on stone, practical observation pose, neutral curious face.', light:'Daylight clear, practical observation, readable.' },
      { file:'page-005.jpg', aspect_ratio:'16:9', brightness:0.92, motion:'pan_slow', scene:'Grandfather sitting on veranda in background, calm gesture not pointing to answer, boy looking toward him from garden distance. No pointing to answer, just calm presence.', light:'Soft warm daylight, veranda scene, calm, no dramatic gesture.' },
      { file:'page-006.jpg', aspect_ratio:'16:9', brightness:0.9, motion:'kenburns_slow', scene:'Two small vignettes implied in one frame: day1 and day2 with same seedling unchanged in crack, no result, still same size, patient observation concept.', light:'Daylight unchanged, seedling same size, no frustration, calm waiting.' },
      { file:'page-007.jpg', aspect_ratio:'16:9', brightness:0.88, motion:'kenburns_slow', scene:'Gentle light breeze moving, tiny light seeds flying in air visible as small white dots with parachutes, boy watching calmly, soft breeze not storm.', light:'Soft airy daylight with small flying seeds visible, light breeze, no storm, no dark.' },
      { file:'page-008.jpg', aspect_ratio:'16:9', brightness:0.86, motion:'kenburns_slow', scene:'Single seed landing into nearby stone crack in wall, gentle wind trail faintly visible, seed falling calmly.', light:'Warm daylight, seed landing visible, calm understanding moment.' },
      { file:'page-009.jpg', aspect_ratio:'16:9', brightness:0.83, motion:'kenburns_slow', scene:'Boy back at original seedling, small new bud on same seedling clearly visible as tiny leaf bud - new word bud clearly visible. Plus nearby additional seed in another crack.', light:'Warm early evening light, new bud clearly visible and highlighted.' },
      { file:'page-010.jpg', aspect_ratio:'16:9', brightness:0.8, motion:'kenburns_slow', scene:'Both boy and grandfather looking together at wall with two seedlings, boy with quiet satisfied smile closed-mouth, grandfather calm nod.', light:'Soft warm evening, settled understanding, calm.' },
      { file:'page-011.jpg', aspect_ratio:'16:9', brightness:0.75, motion:'static', scene:'Static veranda evening: boy and grandfather sitting on low bench in veranda, evening calm, stone wall background, pale crescent moon faintly visible.', light:'Blue twilight balanced with warm lamp glow, moon faint visible, dim but readable.' },
      { file:'page-012.jpg', aspect_ratio:'16:9', brightness:0.7, motion:'static', scene:'Final still: stone wall with small seedlings in cracks and soft moon in sky, boy sleeping quietly in corner of veranda bench outline in silhouette soft, serene.', light:'Dimmest: blue moonlight plus faint lamp, serene readable never dark.' },
      { file:'cover.jpg', aspect_ratio:'1:1', scene:'Square cover: old stone wall with green seedling in crack central, boy observing from low step in lower part, calm clean upper area for title.', light:'Daylight inviting, seedling highlight.' },
      { file:'hero.jpg', aspect_ratio:'16:9', scene:'Wide cinematic: stone wall with seedling in crack on left, small flying seeds in air center, veranda with grandfather in background right. Right forty percent empty darker for title overlay. No embedded title.', light:'Warm to blue gradient, calm.' },
      { file:'thumb.jpg', aspect_ratio:'3:4', scene:'Vertical thumbnail: tall stone wall with seedling in crack central strong silhouette, boy below looking up, moon above faint, upper quarter clean for title layer, no text.', light:'Soft twilight readable.' },
    ]
  },
  {
    story: 'bs-s3',
    title: 'صديق جديد',
    character_lock: 'Sami is same seven-year-old active Arab boy in every image: warm medium skin, short dark hair, large dark eyes, slim energetic proportions, wearing coral t-shirt and teal shorts. Mazin is same seven-year-old calm Arab boy in every image: warm medium skin, short dark wavy hair, large dark friendly eyes, round cheerful face always with joyful closed-mouth smile never sad or lonely, wearing muted teal long-sleeve shirt and cream trousers. Neither boy ever sad, lonely, pity, or bully. Street consistent quiet residential with low steps and soft road.',
    style_tail: " Premium soft 2D kids bedtime storybook illustration, rounded shapes, gentle shading, warm cream, coral, teal and soft gold palette, full-bleed native 16:9, no baked bars, calm low-stimulation, child-safe reassuring, keep faces and action inside central 90%, no text, no letters, no numbers, no logo, no watermark, no frame, no speech bubble, no sad face, no pity, no frightening expression, no clutter, no full darkness.",
    scenes: [
      { file:'page-001.jpg', aspect_ratio:'16:9', brightness:1.0, motion:'kenburns_slow', scene:'Wide quiet residential street daylight. Slim active boy Sami running energetically along street, warm daylight, four groups max.', light:'Bright warm daylight, brightest page, clear sky, Sami running clear.' },
      { file:'page-002.jpg', aspect_ratio:'16:9', brightness:0.98, motion:'kenburns_slow', scene:'Calm neighbor boy Mazin sitting on low house step drawing on large paper pad with colored chalks, joyful cheerful closed-mouth smile, not sad or lonely, happy being quiet. Clearly cheerful face.', light:'Warm daylight, Mazin drawing happily, joyful cheerful expression mandatory.' },
      { file:'page-003.jpg', aspect_ratio:'16:9', brightness:0.96, motion:'pan_slow', scene:'Two boys facing each other in street: Sami pointing toward street as invitation to run, Mazin pointing toward his large paper as invitation to draw. Both equal posture, no one superior.', light:'Daylight, two equal invitations, balanced composition.' },
      { file:'page-004.jpg', aspect_ratio:'16:9', brightness:0.94, motion:'pan_slow', scene:'Two boys still facing: Mazin inviting to draw, Sami indicating he does not like sitting long. Both rejections same tone and posture equally, neither more right.', light:'Daylight, equal rejections, calm.' },
      { file:'page-005.jpg', aspect_ratio:'16:9', brightness:0.92, motion:'pan_slow', scene:'Small quiet split-frame climax: left side Mazin drawing alone on step, right side Sami running alone in street, visual split composition with faint dividing line. Same neutral calm tone both sides, no sadness, no loneliness tragedy, just alone doing own thing.', light:'Daylight split frame clearly showing separate activities, neutral not sad.' },
      { file:'page-006.jpg', aspect_ratio:'16:9', brightness:0.9, motion:'kenburns_slow', scene:'Two small vignettes in one frame: Sami trying to draw with tired posture, Mazin trying to run with tired posture, both equally tired, no one better at other activity.', light:'Daylight, both tired equally, calm trying.' },
      { file:'page-007.jpg', aspect_ratio:'16:9', brightness:0.88, motion:'kenburns_slow', scene:'MOST IMPORTANT THINKING IMAGE: Mazin looking at his large paper pad with thinking pose, eyes considering, paper showing faint track idea, quiet understanding moment about combining drawing and running.', light:'Warm golden evening start, thinking moment well lit.' },
      { file:'page-008.jpg', aspect_ratio:'16:9', brightness:0.86, motion:'kenburns_slow', scene:'Mazin drawing colorful chalk lines on ground road forming long winding track looping and returning, chalk track clearly visible, Sami watching nearby curiously.', light:'Warm evening, chalk track colorful and clearly visible on ground.' },
      { file:'page-009.jpg', aspect_ratio:'16:9', brightness:0.83, motion:'kenburns_slow', scene:'CHALK TRACK ON GROUND MANDATORY VISIBLE: winding colorful chalk race track drawn on quiet street surface, Sami running energetically inside chalk track, Mazin kneeling beside track adding more chalk lines, collaborative play.', light:'Soft early evening, chalk track highlight, collaborative play.' },
      { file:'page-010.jpg', aspect_ratio:'16:9', brightness:0.8, motion:'kenburns_slow', scene:'UNITED FRAME MANDATORY: both boys together in single unified frame no longer split, both clearly visible together side by side near chalk track, neither changed but playing together, calm settled satisfaction not celebration.', light:'Warm evening settled, united frame clearly both together, calm.' },
      { file:'page-011.jpg', aspect_ratio:'16:9', brightness:0.75, motion:'static', scene:'Static quiet evening: both boys sitting on same low step together, evening calm, chalk track still visible on street in front of them, soft crescent moon faint visible above.', light:'Blue twilight plus warm lamp glow, moon faint visible, chalk track still there.' },
      { file:'page-012.jpg', aspect_ratio:'16:9', brightness:0.7, motion:'static', scene:'Final still calm street at night: empty quiet street with colorful chalk track still visible on ground, two house windows faintly lit above, soft moon in sky, no boys big - sleeping concept, serene.', light:'Dimmest blue night with faint window lights and moon, serene readable never dark.' },
      { file:'cover.jpg', aspect_ratio:'1:1', scene:'Square cover: two boys different activities - one running one drawing - both cheerful, chalk track between them, centered calm composition upper clean for title.', light:'Warm daylight inviting.' },
      { file:'hero.jpg', aspect_ratio:'16:9', scene:'Wide cinematic: two boys together creating chalk race track on quiet street. Right forty percent empty darker calm for Arabic title overlay. No embedded title.', light:'Warm to blue gradient, collaborative play highlight.' },
      { file:'thumb.jpg', aspect_ratio:'3:4', scene:'Vertical thumbnail: two small boys side by side strong readable silhouettes, one active one calm both cheerful, chalk track below, moon above faint, upper quarter clean for title, no text.', light:'Soft twilight readable comforting.' },
    ]
  },
  {
    story: 'bs-s4',
    title: 'ليلة المطر',
    character_lock: 'Lama is same seven-year-old Arab girl in every image: warm medium skin, large dark friendly eyes, dark hair tied in two short low pigtails with cream bands, wearing muted lavender pajamas with tiny dots, childlike proportions. Mother is same gentle Arab woman in early thirties: warm medium skin, kind dark eyes, modest dusty-lavender hijab and muted teal long dress, calm closed-mouth expression no teeth. Nightlight small warm lamp with rounded cream shade clearly visible in every single page mandatory, no full darkness anywhere. Bed, window with raindrops consistent.',
    style_tail: " Premium soft 2D kids bedtime storybook illustration, rounded clean shapes, gentle dimensional shading, warm cream, muted lavender, soft blue and gold palette, full-bleed native 16:9, no baked black bars. For every page keep faces, hands, window, nightlight and story action inside central 90%. Calm low-stimulation composition with only named main elements, child-safe reassuring. No text, no letters, no numbers, no logo, no watermark, no frame, no border, no speech bubble, no visible teeth, no frightening storm, no bright lightning bolt drawn, no crying, no clutter, no complete darkness, no window open, no child outside bed.",
    scenes: [
      { file:'page-001.jpg', aspect_ratio:'16:9', brightness:1.0, motion:'kenburns_slow', scene:'Wide calm bedroom night view. Seven-year-old girl Lama sleeping early in low bed near window, rain beginning quiet outside window with small soft raindrops on glass, small warm nightlight clearly visible on bedside table mandatory. Mother not yet present page1.', light:'Brightest evening night with warm nightlight glow plus soft moon, fully readable, rain soft on window, brightest of night pages brightness 1.00.' },
      { file:'page-002.jpg', aspect_ratio:'16:9', brightness:0.98, motion:'kenburns_slow', scene:'Close window view soft raindrops on glass, Lama in bed below looking peaceful liking the sound of rain, calm love of rain sound.', light:'Warm night with rain sparkle on glass, calm love, soft rain light.' },
      { file:'page-003.jpg', aspect_ratio:'16:9', brightness:0.96, motion:'pan_slow', scene:'Rain slightly stronger on window, more droplets, Lama opening eyes hearing distant sound like drum, curious not yet afraid, nightlight clearly visible.', light:'Slightly stronger rain texture on window but still calm, nightlight still visible mandatory.' },
      { file:'page-004.jpg', aspect_ratio:'16:9', brightness:0.94, motion:'pan_slow', scene:'Lama sitting up in low bed, mother entering and sitting directly beside her on bed edge beside, calm caring closed-mouth, nightlight clearly visible mandatory.', light:'Soft night with mother presence warm, nightlight glow steady, readable.' },
      { file:'page-005.jpg', aspect_ratio:'16:9', brightness:0.92, motion:'pan_slow', scene:'SMALL QUIET CLIMAX: faint soft white light reflection on ceiling - NOT a drawn lightning bolt in sky - just gentle light reflection on ceiling surface. Lama holding blanket lightly, calm a bit afraid but not crying heavily, nightlight still visible mandatory, no lightning bolt drawn.', light:'Night with faint ceiling reflection not scary, very soft light flash reflection only, no bright bolt, calm small climax quieter not louder.' },
      { file:'page-006.jpg', aspect_ratio:'16:9', brightness:0.9, motion:'kenburns_slow', scene:'Mother placing hand gently on Lama hand, saying I am here, Lama still looking at ceiling, showing presence alone not enough, mother calm, nightlight clearly visible.', light:'Warm nightlight plus soft blue night, mother hand close, calm.' },
      { file:'page-007.jpg', aspect_ratio:'16:9', brightness:0.88, motion:'kenburns_slow', scene:'TEACHING MOMENT MOST IMPORTANT: mother pointing gently to ceiling reflection and speaking calmly teaching counting method, Lama listening attentively, mother calm informative not scary, nightlight visible.', light:'Soft evening teaching light, well lit for instruction, calm informative.' },
      { file:'page-008.jpg', aspect_ratio:'16:9', brightness:0.86, motion:'kenburns_slow', scene:'Lama looking up ready to count, fingers slightly raised preparing to count, calm preparation, mother beside her, nightlight clearly visible.', light:'Calm preparation light, readable, fingers ready to count visible.' },
      { file:'page-009.jpg', aspect_ratio:'16:9', brightness:0.83, motion:'kenburns_slow', scene:'Three fingers clearly raised visible - counting tool visible mandatory showing one two three counting with hand. Lama calmly counting visible fingers raised, serene counting, nightlight clearly.', light:'Soft night with hand fingers count visible clearly, tool visible.' },
      { file:'page-010.jpg', aspect_ratio:'16:9', brightness:0.8, motion:'kenburns_slow', scene:'Lama lying back listening to rhythm of rain on window glass, calm listening, more raindrop rhythm visible, peaceful after counting, nightlight clearly visible.', light:'Soft calm night listening to rain rhythm, peaceful settled.' },
      { file:'page-011.jpg', aspect_ratio:'16:9', brightness:0.75, motion:'static', scene:'Static quiet: Lama lying down mother tucking blanket gently covering her, warm nightlight clearly visible mandatory, window with softer rain droplets calmer.', light:'Calm dim blue night plus warm nightlight clearly visible mandatory, dim but readable never dark.' },
      { file:'page-012.jpg', aspect_ratio:'16:9', brightness:0.7, motion:'static', scene:'Final still calm bedroom night: whole room still, small warm nightlight glowing clearly, window with few raindrops on glass quiet, Lama sleeping peacefully, rain singing distant concept through quiet window, serene sillage.', light:'Dimmest serene blue night plus clear warm nightlight glow mandatory never dark, raindrops faint, calm sleep.' },
      { file:'cover.jpg', aspect_ratio:'1:1', scene:'Square cover: girl in bed near window with raindrops, mother beside, warm nightlight glow, soft rain, centered calm upper area clean for title.', light:'Warm night inviting, nightlight glow clearly visible.' },
      { file:'hero.jpg', aspect_ratio:'16:9', scene:'Wide cinematic promotional rain night: girl in bed with mother beside, window with raindrops soft glow, nightlight warm. Right forty percent empty dark blue wall gradient no marks no symbols no glyphs no letters, all faces and rain inside safe area. No text any language.', light:'Gentle blue night with warm nightlight glow, low contrast, comforting never dark.' },
      { file:'thumb.jpg', aspect_ratio:'3:4', scene:'Vertical wordless thumbnail NO WRITING: girl in bed with window raindrops, mother close, nightlight warm glow central, readable silhouettes small size, upper quarter smooth empty blue wall gradient, no text letters captions.', light:'Soft blue moon plus warm nightlight readable comforting.' },
    ]
  },
  {
    story: 'bs-s5',
    title: 'الفانوس القديم',
    character_lock: 'Salma is same seven-year-old Arab girl in every image: warm medium skin, large dark friendly eyes, dark hair tied in two low pigtails with cream bands, wearing muted lavender long-sleeve shirt and cream trousers. Grandmother is same gentle older Arab woman in sixties: warm medium skin, kind dark eyes, soft rounded face, modest light-lavender hijab with no hair visible, long sage home dress with lavender cuffs. Old lantern same small round old lantern with dark brown patina rust soft not sharp, closed glass, cold metal, dusty, small handle, never glowing in present, never with flame or fuel, always off. Present light source is warm electric table lamp with rounded cream shade clearly visible.',
    style_tail: " Premium soft 2D kids illustrated storybook, rounded clean shapes, gentle dimensional shading, warm cream, dusty sage, soft rust brown and gold palette, full-bleed native 16:9, no baked bars, calm low-stimulation, child-safe reassuring, keep faces and story action inside central 90%, no text, no letters, no numbers, no logo, no watermark, no frame, no speech bubble, no glowing lantern in present, no flame, no oil, no fuel, no scary rust sharp edges, no clutter, no complete darkness, no wind streaks, no lecturing gesture.",
    scenes: [
      { file:'page-001.jpg', aspect_ratio:'16:9', brightness:1.0, motion:'kenburns_slow', scene:'Wide calm indoor evening: grandmother and seven-year-old girl in front of old open wooden wardrobe, cardboard box inside, warm electric table lamp clearly visible on table mandatory, four groups.', light:'Bright warm daylight plus electric lamp glow, brightest page brightness 1.00, fully readable, no lantern glow.' },
      { file:'page-002.jpg', aspect_ratio:'16:9', brightness:0.98, motion:'kenburns_slow', scene:'Box contents arranged on table: old photos, key, small old brown patina lantern closed glass dusty handle cold metal. Table lamp warm glow visible behind.', light:'Warm daylight, box contents clearly laid out, lantern dusty visible.' },
      { file:'page-003.jpg', aspect_ratio:'16:9', brightness:0.96, motion:'pan_slow', scene:'Girl carefully holding small old lantern with both hands from its base over table, grandmother nearby watching calmly, handle cold appearance, dust on glass.', light:'Warm daylight, lantern held carefully from base, calm.' },
      { file:'page-004.jpg', aspect_ratio:'16:9', brightness:0.94, motion:'pan_slow', scene:'Dry cloth wiping dust from old lantern gently, brown metal patina appearing, electric table lamp clearly visible in background as present light source, not lantern.', light:'Warm light revealing patina, electric lamp still source, no lantern glow.' },
      { file:'page-005.jpg', aspect_ratio:'16:9', brightness:0.92, motion:'pan_slow', scene:'Small quiet climax: old lantern on table dusty rust patina soft not sharp, clearly off and dark no glow, girl looking at it with contemplative neutral face, no sadness tragedy, thinking.', light:'Soft warm evening, lantern clearly off no glow, contemplative calm, small climax quiter not louder.' },
      { file:'page-006.jpg', aspect_ratio:'16:9', brightness:0.9, motion:'kenburns_slow', scene:'Girl hand on lantern handle gently not pulling hard, grandmother gently stopping attempt with soft palm gesture, lantern remains off on table.', light:'Warm light, hand on handle no hard pull, remaining off clearly.' },
      { file:'page-007.jpg', aspect_ratio:'16:9', brightness:0.88, motion:'kenburns_slow', scene:'Grandmother opening old photo beside box, same old lantern visible in old photo near family laughing around low table, real lantern beside photo on table for comparison, both calm.', light:'Warm soft evening, old photo clearly showing lantern in past family scene, gentle.' },
      { file:'page-008.jpg', aspect_ratio:'16:9', brightness:0.86, motion:'kenburns_slow', scene:'Close inside old photo: family around table laughing, old lantern closed glass among them in past not glowing, family warm gathering memory.', light:'Vintage warm toned photo lighting, family memory warm, lantern in past.' },
      { file:'page-009.jpg', aspect_ratio:'16:9', brightness:0.83, motion:'kenburns_slow', scene:'Girl comparing photo and real lantern side by side on table, understanding moment, no glow from present lantern, thinking that lantern was not rusted metal but story.', light:'Warm early evening, understanding moment warm, lantern off still.' },
      { file:'page-010.jpg', aspect_ratio:'16:9', brightness:0.8, motion:'kenburns_slow', scene:'Small paper memory card with date and faint drawing of lantern and family - but text is independent layer not burnt into image - no actual letters visible inside image, just blank card and drawing. Lantern in background.', light:'Soft evening, memory card faint drawing, calm settled.' },
      { file:'page-011.jpg', aspect_ratio:'16:9', brightness:0.75, motion:'static', scene:'Static quiet scene: old lantern placed on low stable wooden shelf beside old photo and small memory card, not to light but to stay, shelf stable low. Present electric lamp dim background.', light:'Calm dim blue twilight plus faint warm lamp glow, settled display shelf.' },
      { file:'page-012.jpg', aspect_ratio:'16:9', brightness:0.7, motion:'static', scene:'Final still calm room: entire room still, shelf with old off lantern, soft light behind curtain, quiet serene final stillness, no event, no lantern glow.', light:'Dimmest serene blue night with faint electric lamp behind curtain, never dark, peaceful.' },
      { file:'cover.jpg', aspect_ratio:'1:1', scene:'Square cover: old patina lantern closed off central, old photos and small key around, warm lamp glow, upper clean for title layer, lantern clearly off.', light:'Warm inviting daylight, lantern highlight but off.' },
      { file:'hero.jpg', aspect_ratio:'16:9', scene:'Wide cinematic old lantern story: girl and grandmother around table with old lantern off in center, old photo open, electric lamp warm. Right forty percent empty darker calm for Arabic title overlay no embedded title.', light:'Warm to blue gradient calm low contrast, memory mood.' },
      { file:'thumb.jpg', aspect_ratio:'3:4', scene:'Vertical thumbnail wordless NO WRITING: old lantern off strong readable silhouette central, girl and grandmother soft behind, shelf concept above faint, upper quarter clean for title, no text.', light:'Soft warm glow readable comforting, lantern off.' },
    ]
  },
  {
    story: 'bs-s6',
    title: 'نجمة تائهة',
    character_lock: 'Nour is same seven-year-old Arab girl in every image: warm medium skin, large dark friendly eyes, dark hair tied in two low pigtails with cream bands, wearing muted lavender pajamas with tiny dots, childlike proportions, no headscarf. Father is same Arab man early thirties: warm medium skin, kind dark eyes, short neat dark brown hair and short trimmed beard, wearing plain dusty-teal home shirt and cream trousers, no thobe, no head covering. Window closed always, mandatory, no open window, no outside at night. Nightlight warm lamp with rounded cream shade clearly visible every single page mandatory, no full darkness. Stars distant small dots no face eyes arms never anthropomorphic, only light point.',
    style_tail: " Premium soft 2D kids bedtime storybook illustration, rounded clean shapes, gentle dimensional shading, warm cream, muted lavender, soft blue and gold star palette, full-bleed native 16:9, no baked black bars. For every page keep faces, hands, window, stars, puddle reflection and nightlight inside central 90%. Calm low-stimulation composition with only named main elements, child-safe reassuring. No text, no letters, no numbers, no logo, no watermark, no frame, no border, no speech bubble, no visible teeth, no scary reflection splitting, no bright laser beams, no shooting star, no star with face, no child outside bedroom at night, no open window, no clutter, no complete darkness, no pulsing glow particles.",
    scenes: [
      { file:'page-001.jpg', aspect_ratio:'16:9', brightness:1.0, motion:'kenburns_slow', scene:'Wide calm bedroom night view: seven-year-old Nour standing near closed window looking at night sky, small warm nightlight clearly visible on bedside table mandatory, bed in corner, warm sky outside window with faint stars distant. Five groups max.', light:'Brightest evening night with warm nightlight glow plus soft moon starlight outside window, fully readable brightness 1.00.' },
      { file:'page-002.jpg', aspect_ratio:'16:9', brightness:0.98, motion:'kenburns_slow', scene:'Distant small stars behind closed window glass faint tiny dots no face, Nour pointing to one small star choosing it to watch, calm attentive.', light:'Warm night stars distant faint tiny light dots no face, nightlight still visible warm.' },
      { file:'page-003.jpg', aspect_ratio:'16:9', brightness:0.96, motion:'pan_slow', scene:'Garden view from behind closed window glass: small dark garden pond puddle with tiny white light point reflection inside water between pebbles, looking like a lost star among pebbles, no solid star object inside water only light reflection point.', light:'Soft night garden view through closed window, small light reflection clearly visible in puddle water between pebbles.' },
      { file:'page-004.jpg', aspect_ratio:'16:9', brightness:0.94, motion:'pan_slow', scene:'Father beside Nour inside bedroom both looking down through closed window toward puddle light point reflection below window, both inside room always, father calm warm closed-mouth, Nour asking how to return star to sky with gentle gesture.', light:'Warm night inside bedroom, father presence warm, closed window clearly closed, puddle light below.' },
      { file:'page-005.jpg', aspect_ratio:'16:9', brightness:0.92, motion:'pan_slow', scene:'Small quiet climax: gentle wind moving causing water surface ripples calmly scattering the tiny light point reflection into pieces, no solid star object broken, just light scattering, Nour a bit sad small but not crying heavily, nightlight clearly visible.', light:'Night with gentle ripples scattering light reflection, very calm small climax quieter not louder, no dramatic bolt.' },
      { file:'page-006.jpg', aspect_ratio:'16:9', brightness:0.9, motion:'kenburns_slow', scene:'Closed window clearly closed, water surface slightly moving, light reflection not visible temporarily, Nour searching with eyes among pebbles without going outside, father beside calmly, real star still visible high in sky above, nightlight visible.', light:'Soft night, water moving temporarily scattering, real stars still above visible, calm searching.' },
      { file:'page-007.jpg', aspect_ratio:'16:9', brightness:0.88, motion:'kenburns_slow', scene:'TEACHING MOMENT IMPORTANT: father finger gently pointing to real same star in sky above then down to puddle showing reflection concept, imaginary explanatory line not solid laser beam drawn, father calm informative, Nour listening attentively, nightlight visible.', light:'Soft teaching light well lit for explanation, father pointing sky to water calm.' },
      { file:'page-008.jpg', aspect_ratio:'16:9', brightness:0.86, motion:'kenburns_slow', scene:'Wind calmed, puddle surface became still calm again ripple gone calm, light reflection point of star clearly visible again in water between pebbles, pebbles under water visible.', light:'Calm still water with clear light reflection point visible again, serene.' },
      { file:'page-009.jpg', aspect_ratio:'16:9', brightness:0.83, motion:'kenburns_slow', scene:'Nour moving head slightly, two soft positions implied, light reflection point moving with viewing angle showing reflection moves with observer, understanding that star did not leave its place, calm discovery.', light:'Soft night, viewpoint shift showing reflection moves with observer, calm discovery not loud.' },
      { file:'page-010.jpg', aspect_ratio:'16:9', brightness:0.8, motion:'kenburns_slow', scene:'Nour calmly relieved understanding, father gently closing curtain partially, nightlight warm, calm settled.', light:'Warm evening settled calm after understanding, curtain closing slightly.' },
      { file:'page-011.jpg', aspect_ratio:'16:9', brightness:0.75, motion:'static', scene:'Static quiet: Nour lying down in bed, star visible from edge of partially closed curtain, warm nightlight faint near bed still clearly visible mandatory.', light:'Calm dim blue evening plus faint warm nightlight visible mandatory, star tiny from curtain edge, dim but readable.' },
      { file:'page-012.jpg', aspect_ratio:'16:9', brightness:0.7, motion:'static', scene:'Final still: Nour sleeping calmly in bed, closed window with curtain almost closed, tiny distant star point still visible in sky above high, entire room still quiet serene, nightlight faint still glowing, no star pulled down.', light:'Dimmest serene blue night with faint warm nightlight glow plus tiny distant star point high, never dark, peaceful final.' },
      { file:'cover.jpg', aspect_ratio:'1:1', scene:'Square cover: closed window night view with small puddle reflection light point central, tiny stars above, girl and father soft behind, upper area clean for title, no solid star inside water only light point.', light:'Warm night inviting, puddle reflection light highlight but no solid star.' },
      { file:'hero.jpg', aspect_ratio:'16:9', scene:'Wide cinematic lost star: night garden puddle viewed through closed window from bedroom, star field above small faint, reflection light point in puddle below, father beside girl. Right forty percent empty dark blue gradient calm no marks no symbols no letters, all faces and puddle reflection inside safe area. No text any language.', light:'Gentle deep blue night with warm nightlight glow inside bedroom, low contrast comforting never dark.' },
      { file:'thumb.jpg', aspect_ratio:'3:4', scene:'Vertical wordless thumbnail NO WRITING: night closed window with puddle reflection light point strong silhouette central, girl and father soft behind, stars above tiny, upper quarter smooth empty dark blue gradient, no text letters.', light:'Soft deep blue with warm nightlight readable comforting.' },
    ]
  },
];

async function getTargets() {
  let targets = BS_STORIES;
  // Append act-s4 from manifest if exists — but compute missing only
  const actS4Path = path.join(__dirname, 'act-s4.manifest.json');
  if (fs.existsSync(actS4Path)) {
    const m = JSON.parse(fs.readFileSync(actS4Path,'utf8'));
    const scenes = m.assets.map(a=>({ file:a.file, aspect_ratio:a.aspect_ratio, brightness:a.brightness, motion:a.motion||'kenburns_slow', scene:a.scene+' '+(a.light||''), light:'', id:m.story+'-'+a.id }));
    const existsFiles = (storyDir) => {
      try { return new Set(fs.readdirSync(storyDir)); } catch { return new Set(); }
    };
    const actS4Out = path.join(ROOT,'tools/playveo/output/act-s4');
    const have = existsFiles(actS4Out);
    const missing = scenes.filter(s=> !have.has(s.file));
    console.log(`act-s4 have=${have.size} missing=${missing.map(s=>s.file).join(', ')||'none'}`);
    if (ONLY_STORY==='act-s4') {
      // if --story act-s4, produce only missing files to save credits
      const toDo = missing.length>0 ? missing : scenes;
      targets = [{ story:'act-s4', title:'أحضان الدفء', character_lock:m.character_lock, style_tail:m.style_tail, scenes: toDo }];
    } else if (!ONLY_STORY && missing.length>0) {
      targets.push({ story:'act-s4', title:'أحضان الدفء - remaining only', character_lock:m.character_lock, style_tail:m.style_tail, scenes: missing });
    } else if (!ONLY_STORY) {
      console.log('✅ act-s4 already complete, skipping');
    }
  }
  if (ONLY_STORY && ONLY_STORY!=='act-s4') {
    targets = targets.filter(t=>t.story===ONLY_STORY);
  }
  if (!targets.length) { console.error('No targets for ONLY_STORY filter'); process.exit(1); }
  return targets;
}

async function processStory(st) {
  console.log(`\n━━━━━━━━━━━━━━━━ Story ${st.story} — ${st.title} — ${st.scenes.length} assets`);
  const outDir = path.join(ROOT,'tools/playveo/output', st.story);
  const appAssetDir = path.join(ROOT,'app_main','assets','images','stories', `${st.story}-playveo`);
  fs.mkdirSync(outDir,{recursive:true});
  fs.mkdirSync(appAssetDir,{recursive:true});
  const byAspect = {};
  for (const sc of st.scenes) {
    const asp = sc.aspect_ratio||'16:9';
    if (!byAspect[asp]) byAspect[asp]=[];
    byAspect[asp].push(sc);
  }
  let ok=0, fail=0;
  const grantLogPath = path.join(outDir,'_bulk-grand-run-log.json');
  const grandLog = fs.existsSync(grantLogPath) ? JSON.parse(fs.readFileSync(grantLogPath,'utf8')) : [];
  // also central log
  const centralLogPath = path.join(ROOT,'tools/playveo/output','_bulk-grand-run-log.json');
  const centralLog = fs.existsSync(centralLogPath) ? JSON.parse(fs.readFileSync(centralLogPath,'utf8')) : [];

  for (const [aspect, scenes] of Object.entries(byAspect)) {
    console.log(`\n  --- Aspect ${aspect} ${scenes.length} scenes`);
    const seenNorm=new Map();
    const uniqScenes=[], uniqPrompts=[];
    for (const sc of scenes) {
      const prompt = (st.character_lock? st.character_lock+' ' : '') + sc.scene + ' ' + (sc.light||'') + ' ' + st.style_tail;
      const cleaned = prompt.replace(/\s+/g,' ').trim();
      if (!cleaned) throw new Error(`empty prompt ${st.story}/${sc.file}`);
      const norm = normalizePrompt(cleaned);
      if (!seenNorm.has(norm)) { seenNorm.set(norm,true); uniqScenes.push(sc); uniqPrompts.push(cleaned); }
      else console.warn(`   ⚠️ skip dup ${sc.file} norm ${norm.slice(0,60)}`);
    }
    // chunk bulk 10
    for (let i=0;i<uniqScenes.length;i+=BULK_LIMIT) {
      const chunkScenes = uniqScenes.slice(i,i+BULK_LIMIT);
      const chunkPrompts = uniqPrompts.slice(i,i+BULK_LIMIT);
      console.log(`\n  📦 Bulk chunk ${Math.floor(i/BULK_LIMIT)+1} — ${chunkScenes.length} prompts aspect=${aspect} | files: ${chunkScenes.map(s=>s.file).join(', ')}`);
      let jobs;
      try { jobs = await bulkPost(chunkPrompts, aspect); }
      catch(e){ console.error(`   ❌ bulk submit failed ${st.story} ${aspect}: ${e.message}`); fail+=chunkScenes.length; continue; }
      if (jobs.length !== chunkScenes.length) console.warn(`   ⚠️ jobs ${jobs.length} != scenes ${chunkScenes.length} – mapping by index`);
      const results = await Promise.all(chunkScenes.map(async (sceneObj, idx)=>{
        const job = jobs[idx];
        if (!job) return { sceneObj, error:'no job meta' };
        try{
          const done = await waitImage(job.id);
          const url = (done.resultUrls && done.resultUrls[0]) || done.result_urls?.[0] || done.url || done.resultUrl;
          if (!url) throw new Error('no result url in '+JSON.stringify(done).slice(0,400));
          const dstJpg = path.join(outDir, sceneObj.file);
          const len = await downloadImage(url, dstJpg);
          console.log(`   💾 ${st.story}/${sceneObj.file} ${len}B job=${job.id.slice(0,8)}`);
          const mirror = path.join(appAssetDir, sceneObj.file);
          if (!DRY) { try{ fs.copyFileSync(dstJpg, mirror); console.log(`   🪞 mirrored -> app_main/.../${st.story}-playveo/${sceneObj.file}`);}catch(e){ console.warn('mirror fail', e.message);} }
          grandLog.push({ at:new Date().toISOString(), story:st.story, file:sceneObj.file, jobId:job.id, model:MODEL, aspect, bytes:len });
          centralLog.push({ at:new Date().toISOString(), story:st.story, file:sceneObj.file, jobId:job.id, model:MODEL, aspect, bytes:len });
          return { ok:true, sceneObj, jobId:job.id, bytes:len };
        } catch(e){
          console.error(`   ❌ ${sceneObj.file} fail ${e.message}`);
          return { sceneObj, error:e.message, jobId:job?.id };
        }
      }));
      for (const r of results) { if (r.ok) ok++; else fail++; }
      fs.writeFileSync(grantLogPath, JSON.stringify(grandLog,null,2));
      fs.writeFileSync(centralLogPath, JSON.stringify(centralLog,null,2));
    }
  }
  console.log(`\n🏁 Story ${st.story} done OK=${ok} FAIL=${fail} | out=${outDir}`);
  return { story:st.story, ok, fail };
}

async function main() {
  const targets = await getTargets();
  console.log(`\n📚 Targets: ${targets.map(t=> `${t.story}(${t.scenes.length})`).join(', ')} | total assets=${targets.reduce((a,t)=>a+t.scenes.length,0)}`);
  if (DRY) {
    for (const t of targets) {
      console.log(`\n━━━ ${t.story} ${t.title} ${t.scenes.length}`);
      for (const s of t.scenes) console.log(`  ${s.file} ${s.aspect_ratio} ${(t.character_lock+' '+s.scene+' '+t.style_tail).length}ch`);
    }
    console.log('\n🔎 dry-run done - no billing');
    return;
  }
  let grandOk=0, grandFail=0;
  for (const st of targets) {
    const res = await processStory(st);
    grandOk+=res.ok; grandFail+=res.fail;
  }
  console.log(`\n🏁 GRAND TOTAL OK=${grandOk} FAIL=${grandFail}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
