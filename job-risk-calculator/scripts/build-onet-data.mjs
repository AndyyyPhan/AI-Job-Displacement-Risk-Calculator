import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAW_DIR = resolve(__dirname, '..', 'data', 'onet-raw')
const OUT_FILE = resolve(__dirname, '..', 'src', 'data', 'onet.json')

// Skills with IM (Importance) >= this threshold are kept for an occupation.
// Scale is 1-5. 3.5 typically yields 6-12 core skills per occupation.
const SKILL_IMPORTANCE_THRESHOLD = 3.5

function readSheet(filename) {
  const path = resolve(RAW_DIR, filename)
  const buf = readFileSync(path)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

function main() {
  console.log('→ Reading Occupation Data.xlsx')
  const occRows = readSheet('Occupation Data.xlsx')

  console.log('→ Reading Alternate Titles.xlsx')
  const altRows = readSheet('Alternate Titles.xlsx')

  console.log('→ Reading Sample of Reported Titles.xlsx')
  const reportedRows = readSheet('Sample of Reported Titles.xlsx')

  console.log('→ Reading Task Statements.xlsx')
  const taskRows = readSheet('Task Statements.xlsx')

  console.log('→ Reading Skills.xlsx')
  const skillRows = readSheet('Skills.xlsx')

  const occMap = new Map()
  for (const row of occRows) {
    const code = String(row['O*NET-SOC Code'] ?? '').trim()
    if (!code) continue
    occMap.set(code, {
      code,
      title: String(row['Title'] ?? '').trim(),
      description: String(row['Description'] ?? '').trim(),
      altTitles: [],
      reportedTitles: [],
      tasks: [],
      skills: [],
    })
  }

  for (const row of altRows) {
    const code = String(row['O*NET-SOC Code'] ?? '').trim()
    const occ = occMap.get(code)
    if (!occ) continue
    const alt = String(row['Alternate Title'] ?? '').trim()
    if (alt && !occ.altTitles.includes(alt)) occ.altTitles.push(alt)
  }

  for (const row of reportedRows) {
    const code = String(row['O*NET-SOC Code'] ?? '').trim()
    const occ = occMap.get(code)
    if (!occ) continue
    const rep = String(row['Reported Job Title'] ?? '').trim()
    if (rep && !occ.reportedTitles.includes(rep)) occ.reportedTitles.push(rep)
  }

  // Core tasks only — Supplemental tasks are secondary and bloat the JSON.
  let taskCount = 0
  for (const row of taskRows) {
    const code = String(row['O*NET-SOC Code'] ?? '').trim()
    const occ = occMap.get(code)
    if (!occ) continue
    const taskType = String(row['Task Type'] ?? '').trim()
    if (taskType !== 'Core') continue
    const text = String(row['Task'] ?? '').trim()
    if (!text) continue
    const id = Number(row['Task ID'])
    occ.tasks.push({ id: Number.isFinite(id) ? id : null, text })
    taskCount++
  }

  // Skills: use Importance (IM) scale; filter to important skills per occupation.
  const skillsByCode = new Map()
  for (const row of skillRows) {
    const scaleId = String(row['Scale ID'] ?? '').trim()
    if (scaleId !== 'IM') continue
    const code = String(row['O*NET-SOC Code'] ?? '').trim()
    if (!occMap.has(code)) continue
    const im = Number(row['Data Value'])
    if (!Number.isFinite(im)) continue
    const name = String(row['Element Name'] ?? '').trim()
    if (!name) continue
    if (!skillsByCode.has(code)) skillsByCode.set(code, [])
    skillsByCode.get(code).push({ name, im })
  }

  for (const [code, list] of skillsByCode.entries()) {
    list.sort((a, b) => b.im - a.im)
    const filtered = list.filter((s) => s.im >= SKILL_IMPORTANCE_THRESHOLD)
    // Fall back to top 8 if nothing clears the threshold.
    const keep = filtered.length >= 5 ? filtered : list.slice(0, 8)
    occMap.get(code).skills = keep.map((s) => s.name)
  }

  const occupations = [...occMap.values()]
    .filter((o) => o.tasks.length > 0 && o.title)
    .sort((a, b) => a.code.localeCompare(b.code))

  const payload = {
    generatedAt: new Date().toISOString(),
    occupationCount: occupations.length,
    coreTaskCount: taskCount,
    occupations,
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  const json = JSON.stringify(payload)
  writeFileSync(OUT_FILE, json)

  const sizeMb = (json.length / 1024 / 1024).toFixed(2)
  console.log('')
  console.log(`✓ Wrote ${occupations.length} occupations`)
  console.log(`✓ ${taskCount} core tasks`)
  console.log(`✓ ${sizeMb} MB → ${OUT_FILE}`)
}

main()
