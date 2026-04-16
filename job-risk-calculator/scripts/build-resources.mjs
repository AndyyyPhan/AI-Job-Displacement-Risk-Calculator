import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_FILE = resolve(__dirname, 'resources-seed.json')
const OUT_FILE = resolve(__dirname, '..', 'src', 'data', 'resources.json')

const REQUEST_TIMEOUT_MS = 8000
const CONCURRENCY = 8
const UA =
  'Mozilla/5.0 (compatible; AI-Job-Risk-Calc-Build/1.0; +https://github.com/)'

async function headCheck(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: '*/*' },
      signal: controller.signal,
    })
    if (res.ok || (res.status >= 200 && res.status < 400)) return { ok: true, status: res.status }
    if (res.status === 405 || res.status === 403) {
      return await getCheck(url, controller.signal)
    }
    return { ok: false, status: res.status }
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, status: 0, error: 'timeout' }
    return { ok: false, status: 0, error: err.message }
  } finally {
    clearTimeout(timer)
  }
}

async function getCheck(url, signal) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: '*/*' },
      signal,
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, status: 0, error: err.message }
  }
}

async function pMap(items, mapper, concurrency) {
  const results = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const index = i++
      results[index] = await mapper(items[index], index)
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker)
  await Promise.all(workers)
  return results
}

function validateEntry(entry) {
  const errors = []
  if (!entry.id) errors.push('missing id')
  if (!entry.title) errors.push('missing title')
  if (!entry.url) errors.push('missing url')
  if (!Array.isArray(entry.occupational_families) || entry.occupational_families.length === 0)
    errors.push('missing occupational_families')
  if (!Array.isArray(entry.skill_categories) || entry.skill_categories.length === 0)
    errors.push('missing skill_categories')
  return errors
}

async function main() {
  const raw = readFileSync(SEED_FILE, 'utf8')
  const seed = JSON.parse(raw)
  if (!Array.isArray(seed)) {
    console.error('✗ resources-seed.json must be a JSON array')
    process.exit(1)
  }

  console.log(`→ ${seed.length} seed entries`)

  const seenIds = new Set()
  const structurallyValid = []
  for (const entry of seed) {
    const errs = validateEntry(entry)
    if (errs.length > 0) {
      console.warn(`  ✗ ${entry.id ?? '<no id>'}: ${errs.join(', ')}`)
      continue
    }
    if (seenIds.has(entry.id)) {
      console.warn(`  ✗ duplicate id: ${entry.id}`)
      continue
    }
    seenIds.add(entry.id)
    structurallyValid.push(entry)
  }

  console.log(`→ ${structurallyValid.length} structurally valid`)
  console.log(`→ verifying URLs (concurrency=${CONCURRENCY})...`)

  const verified = await pMap(
    structurallyValid,
    async (entry) => {
      const check = await headCheck(entry.url)
      return { entry, check }
    },
    CONCURRENCY,
  )

  const kept = []
  const dropped = []
  for (const { entry, check } of verified) {
    if (check.ok) {
      kept.push(entry)
    } else {
      dropped.push({ id: entry.id, url: entry.url, status: check.status, error: check.error })
    }
  }

  if (dropped.length > 0) {
    console.log('')
    console.log(`✗ ${dropped.length} URLs failed verification:`)
    for (const d of dropped) {
      const tail = d.error ? `(${d.error})` : `HTTP ${d.status}`
      console.log(`    ${d.id} — ${d.url} ${tail}`)
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    entries: kept,
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2))

  console.log('')
  console.log(`✓ Wrote ${kept.length} entries (${dropped.length} dropped) → ${OUT_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
