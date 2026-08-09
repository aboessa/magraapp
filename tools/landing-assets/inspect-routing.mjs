/**
 * يكشف من يخدم majarra.app فعلًا: سجلات DNS، ومسارات الـWorkers،
 * ونطاقات مشروع Pages. تشخيص فقط، لا يعدّل شيئًا.
 *
 * يقرأ رمز OAuth الخاص بـwrangler من إعداد المستخدم ولا يطبعه.
 *
 * التشغيل: node tools/landing-assets/inspect-routing.mjs
 */
import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ZONE_NAME = process.argv[2] ?? 'majarra.app'
const CONFIG = path.join(os.homedir(), 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml')

const config = readFileSync(CONFIG, 'utf8')
const token = config.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1]
if (!token) throw new Error('لم أجد رمز OAuth في إعداد wrangler')

const API = 'https://api.cloudflare.com/client/v4'
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

async function call(pathname) {
  const response = await fetch(`${API}${pathname}`, { headers: auth })
  const body = await response.json().catch(() => null)
  if (!body?.success) {
    return { ok: false, status: response.status, errors: body?.errors ?? null }
  }
  return { ok: true, result: body.result }
}

const zones = await call(`/zones?name=${ZONE_NAME}`)
if (!zones.ok || !zones.result.length) {
  console.log('تعذّر قراءة النطاق:', JSON.stringify(zones.errors ?? zones))
  process.exit(1)
}
const zone = zones.result[0]
console.log(`النطاق: ${zone.name}  (id ${zone.id})  الحالة: ${zone.status}`)
console.log(`الحساب: ${zone.account?.name}`)

console.log('\n--- سجلات DNS للجذر والفروع المهمة ---')
const dns = await call(`/zones/${zone.id}/dns_records?per_page=100`)
if (dns.ok) {
  for (const record of dns.result) {
    if (!['A', 'AAAA', 'CNAME', 'MX', 'TXT'].includes(record.type)) continue
    const proxied = record.proxied ? 'proxied' : 'dns-only'
    console.log(`  ${record.type.padEnd(6)} ${record.name.padEnd(28)} -> ${String(record.content).slice(0, 60).padEnd(60)} ${proxied}`)
  }
  const mx = dns.result.filter((r) => r.type === 'MX')
  console.log(`\n  عدد سجلات MX: ${mx.length}${mx.length === 0 ? '  ← لا استقبال بريد على هذا النطاق' : ''}`)
} else {
  console.log('  تعذّر:', JSON.stringify(dns.errors))
}

console.log('\n--- مسارات الـWorkers على النطاق ---')
const routes = await call(`/zones/${zone.id}/workers/routes`)
if (routes.ok) {
  if (!routes.result.length) console.log('  لا مسارات')
  for (const route of routes.result) {
    console.log(`  ${route.pattern.padEnd(34)} -> ${route.script ?? '(بلا سكربت)'}`)
  }
} else {
  console.log('  تعذّر:', JSON.stringify(routes.errors))
}

console.log('\n--- مشاريع Pages ونطاقاتها ---')
const projects = await call(`/accounts/${zone.account.id}/pages/projects`)
if (projects.ok) {
  for (const project of projects.result) {
    if (!project.domains?.some((d) => d.includes(ZONE_NAME))) continue
    console.log(`  ${project.name}`)
    console.log(`     النطاقات: ${project.domains.join(', ')}`)
    console.log(`     فرع الإنتاج: ${project.production_branch}`)
    const latest = project.latest_deployment
    if (latest) {
      console.log(`     آخر نشر: ${latest.id?.slice(0, 8)} · ${latest.environment} · ${latest.created_on}`)
      console.log(`     عنوانه: ${latest.url}`)
    }
    const canonical = project.canonical_deployment
    if (canonical) {
      console.log(`     النشر المُعتمد للنطاق: ${canonical.id?.slice(0, 8)} · ${canonical.created_on}`)
    }
  }
} else {
  console.log('  تعذّر:', JSON.stringify(projects.errors))
}
