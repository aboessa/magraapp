#!/usr/bin/env node
// Upload all story images and audio to R2 - split into assets only, no D1 yet
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const scriptDir = path.dirname(__filename)
const apiDir = path.resolve(scriptDir, '..')
const rootDir = path.resolve(apiDir, '..', '..')
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform==='win32'?'wrangler.cmd':'wrangler')

function run(argv){
  return new Promise((resolve, reject)=>{
    const child=spawn(wrangler, argv, { cwd: apiDir, stdio: 'pipe', shell: process.platform==='win32' })
    let err=''
    child.stderr?.on('data', c=> err+=c)
    child.on('close', code=> code===0? resolve() : reject(new Error(`wrangler ${argv.join(' ')} exited ${code}: ${err.slice(0,500)}`)))
  })
}

const STORIES = [
  { pages: 8, imageDir: 'app_main/assets/images/stories/act-s1-playveo', audioDir: 'assets/audio/stories/act-s1/ar', prefix: 'act-s1' },
  { id: 'act-s2', pages: 8, imageDir: 'app_main/assets/images/stories/act-s2-playveo', audioDir: 'assets/audio/stories/act-s2/ar', prefix: 'act-s2' },
  { id: 'act-s3', pages: 8, imageDir: 'app_main/assets/images/stories/act-s3-playveo', audioDir: 'assets/audio/stories/act-s3/ar', prefix: 'act-s3' },
  { id: 'act-s4', pages: 8, imageDir: 'app_main/assets/images/stories/act-s4-playveo', audioDir: 'assets/audio/stories/act-s4/ar', prefix: 'act-s4' },
  { id: 'bs-s1', pages: 12, imageDir: 'app_main/assets/images/stories/bs-s1-playveo', audioDir: 'assets/audio/stories/bs-s1/ar', prefix: 'bs-s1' },
  { id: 'bs-s2', pages: 12, imageDir: 'app_main/assets/images/stories/bs-s2-playveo', audioDir: 'assets/audio/stories/bs-s2/ar', prefix: 'bs-s2' },
  { id: 'bs-s3', pages: 12, imageDir: 'app_main/assets/images/stories/bs-s3-playveo', audioDir: 'assets/audio/stories/bs-s3/ar', prefix: 'bs-s3' },
  { id: 'bs-s4', pages: 12, imageDir: 'app_main/assets/images/stories/bs-s4-playveo', audioDir: 'assets/audio/stories/bs-s4/ar', prefix: 'bs-s4' },
  { id: 'bs-s5', pages: 12, imageDir: 'app_main/assets/images/stories/bs-s5-playveo', audioDir: 'assets/audio/stories/bs-s5/ar', prefix: 'bs-s5' },
  { id: 'bs-s6', pages: 12, imageDir: 'app_main/assets/images/stories/bs-s6-playveo', audioDir: 'assets/audio/stories/bs-s6/ar', prefix: 'bs-s6' },
  { id: 'qml-promised', pages: 18, imageDir: 'app_main/assets/images/stories/qml-the-promised-friday-playveo', audioDir: 'assets/audio/stories/qml-the-promised-friday/ar', prefix: 'qml-promised-friday' },
  { id: 'qml-nine', pages: 18, imageDir: 'app_main/assets/images/stories/qml-nine-metres-playveo', audioDir: 'assets/audio/stories/qml-nine-metres/ar', prefix: 'qml-nine-metres' },
  { id: 'qml-taller', pages: 20, imageDir: 'app_main/assets/images/stories/qml-taller-than-me-playveo', audioDir: 'assets/audio/stories/qml-taller-than-me/ar', prefix: 'qml-taller-than-me' },
  { id: 'qml-key', pages: 16, imageDir: 'app_main/assets/images/stories/qml-the-key-that-was-left-playveo', audioDir: 'assets/audio/stories/qml-the-key-that-was-left/ar', prefix: 'qml-key-left' },
  { id: 'qml-extra', pages: 18, imageDir: 'app_main/assets/images/stories/qml-the-extra-page-playveo', audioDir: 'assets/audio/stories/qml-the-extra-page/ar', prefix: 'qml-extra-page' },
];

async function main(){
  const isRemote=true
  let total=0, done=0
  for(const s of STORIES){
    const absDir=path.join(rootDir, s.imageDir)
    try{
      const files=await fs.readdir(absDir)
      const jpgs=files.filter(f=> f.endsWith('.jpg'))
      for(const jpg of jpgs){
        const absPath=path.join(absDir, jpg)
        const r2Key=`public/catalog/${s.imageDir}/${jpg}`
        try{
          await run(['r2','object','put', `majarra-thumbs/${r2Key}`, `--file=${absPath}`, '--content-type=image/jpeg', '--remote', '--env', 'production'], { quiet: true })
          done++
          total++
          if(done%20===0) console.log(`uploaded ${done} images...`);
        }catch(e){
          console.error(`fail ${r2Key}: ${e.message.slice(0,200)}`)
        }
      }
    }catch(e){
      console.warn(`no dir ${s.imageDir}: ${e.message}`)
    }
    // Audio
    const audioAbsDir=path.join(rootDir, s.audioDir)
    try{
      const files=await fs.readdir(audioAbsDir)
      const wavs=files.filter(f=> f.endsWith('-ar.wav') || (f.endsWith('.wav') && !f.includes('_pre-normalize')))
      for(const wav of wavs.slice(0, s.pages)){
        const absPath=path.join(audioAbsDir, wav)
        const r2Key=`public/catalog/${s.audioDir}/${wav}`
        try{
          await run(['r2','object','put', `majarra-thumbs/${r2Key}`, `--file=${absPath}`, '--content-type=audio/wav', '--remote', '--env', 'production'], { quiet: true })
          done++
          total++
          if(done%20===0) console.log(`uploaded ${done} total (images+audio)...`);
        }catch(e){
          console.error(`fail audio ${r2Key}: ${e.message.slice(0,200)}`)
        }
      }
    }catch(e){
      console.warn(`no audio dir ${s.audioDir}`)
    }
  }
  console.log(`\nDone R2 upload: ${total} files`);
}

await main()
