import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RAW_DIR = resolve(ROOT, 'data', 'onet-raw')
const ELOUNDOU_DIR = resolve(ROOT, 'data', 'eloundou-beta')
const ECONOMIC_INDEX_DIR = resolve(ROOT, 'data', 'economic-index')
const BLS_WAGES_DIR = resolve(ROOT, 'data', 'bls-wages')
const BLS_PROJECTIONS_DIR = resolve(ROOT, 'data', 'bls-projections')
const OUT_FILE = resolve(ROOT, 'src', 'data', 'onet.json')

const SKILL_IMPORTANCE_THRESHOLD = 3.5

// ============================================================================
// Generic spreadsheet / CSV / JSON reading
// ============================================================================

function readSheetFromPath(path) {
  const ext = extname(path).toLowerCase()
  if (ext === '.json') {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : parsed.rows ?? parsed.data ?? []
  }
  if (ext === '.csv' || ext === '.tsv') {
    const buf = readFileSync(path)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(sheet, { defval: '' })
  }
  // xlsx / xls
  const buf = readFileSync(path)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

function readOnetSheet(filename) {
  const path = resolve(RAW_DIR, filename)
  return readSheetFromPath(path)
}

function listDataFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => /\.(xlsx|xls|csv|tsv|json)$/i.test(name))
    .map((name) => resolve(dir, name))
}

function findColumn(row, candidates) {
  const keys = Object.keys(row)
  for (const cand of candidates) {
    const lower = cand.toLowerCase()
    const hit = keys.find((k) => k.toLowerCase() === lower)
    if (hit) return hit
  }
  // partial match
  for (const cand of candidates) {
    const lower = cand.toLowerCase()
    const hit = keys.find((k) => k.toLowerCase().includes(lower))
    if (hit) return hit
  }
  return null
}

function num(value) {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).replace(/[,$%\s]/g, '')
  if (s === '*' || s === '-' || s === 'N/A' || s === 'NA') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function normalizeSocCode(code) {
  let s = String(code ?? '').trim()
  if (!s) return ''
  // BLS projections wraps codes in Excel's formula-preservation syntax ="13-2011"
  const excelMatch = s.match(/^="?(.*?)"?=?$/)
  if (excelMatch) s = excelMatch[1].trim()
  s = s.replace(/^"|"$/g, '').trim()
  // O*NET uses NN-NNNN.NN; BLS/SOC uses NN-NNNN. Normalize to the 6-digit SOC prefix.
  const m = s.match(/^(\d{2})-?(\d{4})(?:\.\d+)?$/)
  if (m) return `${m[1]}-${m[2]}`
  return s
}

function socMajorGroup(code) {
  return `${code.slice(0, 2)}-0000`
}

// ============================================================================
// Upstream dataset loaders — tolerant of format variations
// ============================================================================

// Eloundou et al. publishes occupation-level β scores, not task-level. We return
// a Map<SOC, { beta, alpha, gamma }> and spread the occupation β uniformly to
// every task under that SOC. Per-task variation is not available in this file.
function loadEloundouBeta() {
  const files = listDataFiles(ELOUNDOU_DIR)
  if (files.length === 0) return null

  const bySoc = new Map()

  for (const file of files) {
    const rows = readSheetFromPath(file)
    if (rows.length === 0) continue
    const first = rows[0]
    const socCol = findColumn(first, ['O*NET-SOC Code', 'ONET-SOC Code', 'soc', 'SOC'])
    // Prefer human-rated β (the paper's headline metric); fall back to
    // model-derived β if only that is present.
    const betaCol =
      findColumn(first, ['human_rating_beta', 'beta_human', 'beta']) ||
      findColumn(first, ['dv_rating_beta', 'beta_gpt4'])
    if (!socCol || !betaCol) {
      console.warn(`  ! ${file}: no SOC or β column found`)
      continue
    }
    for (const row of rows) {
      const code = normalizeSocCode(row[socCol])
      if (!code) continue
      const beta = num(row[betaCol])
      if (beta === null) continue
      // Clamp to [0, 1]
      const clamped = Math.max(0, Math.min(1, beta))
      bySoc.set(code, clamped)
    }
  }

  console.log(`  ✓ Eloundou: ${bySoc.size} occupation-level β values`)
  return bySoc
}

function normalizeTaskText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// The Anthropic Economic Index publishes task-name → AI usage share, not
// per-SOC observed exposure. We compute observed_exposure per occupation as
// the share of its O*NET core tasks that appear in the task-mappings file
// at all. It's a presence-based measure, not a weighted one — a coarser but
// defensible proxy for "how many of this occupation's tasks are actually
// being performed by AI today."
//
// Also pre-computes per-task observed flags so the main loop can cheaply
// check whether a specific task appears in the AI usage data.
function loadEconomicIndex() {
  const files = listDataFiles(ECONOMIC_INDEX_DIR)
  if (files.length === 0) return null

  const observedTaskTexts = new Set()
  for (const file of files) {
    if (!/task_mapping|onet_task/i.test(file)) continue
    const rows = readSheetFromPath(file)
    if (rows.length === 0) continue
    const first = rows[0]
    const taskCol = findColumn(first, ['task_name', 'task', 'Task', 'onet_task', 'task_description'])
    if (!taskCol) {
      console.warn(`  ! ${file}: no task_name column found`)
      continue
    }
    for (const row of rows) {
      const text = normalizeTaskText(row[taskCol])
      if (text) observedTaskTexts.add(text)
    }
  }

  if (observedTaskTexts.size === 0) {
    console.warn('  ! Economic Index: no task mappings extracted')
    return null
  }
  console.log(`  ✓ Economic Index: ${observedTaskTexts.size} observed O*NET task mappings`)
  return { observedTaskTexts }
}

function loadBlsWages() {
  const files = listDataFiles(BLS_WAGES_DIR)
  if (files.length === 0) return null
  const bySoc = new Map()
  let meanFallbackCount = 0
  for (const file of files) {
    const rows = readSheetFromPath(file)
    if (rows.length === 0) continue
    const first = rows[0]
    const socCol = findColumn(first, ['OCC_CODE', 'soc', 'SOC', 'occupation_code'])
    const medianCol = findColumn(first, [
      'A_MEDIAN',
      'median_wage',
      'annual_median_wage',
      'median',
    ])
    // Fallback to arithmetic mean when median is suppressed. BLS marks
    // suppressed values with '#' — common for high-wage occupations like
    // physicians, where median disclosure would risk identifying individuals.
    const meanCol = findColumn(first, ['A_MEAN', 'annual_mean_wage', 'mean_annual_wage'])
    if (!socCol || !medianCol) {
      console.warn(`  ! ${file}: could not find SOC or wage columns`)
      continue
    }
    for (const row of rows) {
      const code = normalizeSocCode(row[socCol])
      if (!code) continue
      let wage = num(row[medianCol])
      if (wage === null && meanCol) {
        wage = num(row[meanCol])
        if (wage !== null) meanFallbackCount++
      }
      if (wage === null) continue
      // If we already have a value for this SOC, prefer the first (national
      // cross-industry row usually comes first in the BLS file).
      if (!bySoc.has(code)) bySoc.set(code, wage)
    }
  }
  console.log(
    `  ✓ BLS wages: ${bySoc.size} SOC codes (${meanFallbackCount} used A_MEAN because A_MEDIAN was suppressed)`,
  )
  return bySoc
}

function loadBlsProjections() {
  const files = listDataFiles(BLS_PROJECTIONS_DIR)
  if (files.length === 0) return null
  const bySoc = new Map()
  for (const file of files) {
    const rows = readSheetFromPath(file)
    if (rows.length === 0) continue
    const first = rows[0]
    const socCol = findColumn(first, [
      'Occupation Code',
      '2024 National Employment Matrix code',
      'OCC_CODE',
      'soc',
      'SOC',
    ])
    const growthCol = findColumn(first, [
      'Employment Percent Change, 2024-2034',
      'Employment change, percent, 2024-34',
      'Percent change 2024-34',
      'percent_change',
      'growth_pct',
    ])
    if (!socCol || !growthCol) {
      console.warn(`  ! ${file}: could not find SOC or growth columns`)
      continue
    }
    for (const row of rows) {
      const code = normalizeSocCode(row[socCol])
      if (!code) continue
      const pct = num(row[growthCol])
      if (pct === null) continue
      bySoc.set(code, pct)
    }
  }
  console.log(`  ✓ BLS projections: ${bySoc.size} SOC codes`)
  return bySoc
}

// ============================================================================
// Aggregations
// ============================================================================

function computeGroupAverages(bySoc) {
  const groups = new Map()
  for (const [code, value] of bySoc) {
    const major = socMajorGroup(code)
    if (!groups.has(major)) groups.set(major, { sum: 0, count: 0 })
    const g = groups.get(major)
    g.sum += value
    g.count += 1
  }
  const out = new Map()
  for (const [major, { sum, count }] of groups) out.set(major, sum / count)
  return out
}

function lookupWithFallback(bySoc, groupAverages, fallbackValue, code, fallbackFields, fieldName) {
  if (bySoc && bySoc.has(code)) return bySoc.get(code)
  if (groupAverages) {
    const major = socMajorGroup(code)
    if (groupAverages.has(major)) {
      fallbackFields.push(fieldName)
      return groupAverages.get(major)
    }
  }
  fallbackFields.push(fieldName)
  return fallbackValue
}

function computeWageQuartiles(bySoc) {
  if (!bySoc || bySoc.size === 0) return null
  const sorted = [...bySoc.entries()].sort((a, b) => a[1] - b[1])
  const quartileMap = new Map()
  const n = sorted.length
  for (let i = 0; i < n; i++) {
    const pct = (i + 1) / n
    let q
    if (pct <= 0.25) q = 1
    else if (pct <= 0.5) q = 2
    else if (pct <= 0.75) q = 3
    else q = 4
    quartileMap.set(sorted[i][0], q)
  }
  return quartileMap
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('→ Reading Occupation Data.xlsx')
  const occRows = readOnetSheet('Occupation Data.xlsx')

  console.log('→ Reading Alternate Titles.xlsx')
  const altRows = readOnetSheet('Alternate Titles.xlsx')

  console.log('→ Reading Sample of Reported Titles.xlsx')
  const reportedRows = readOnetSheet('Sample of Reported Titles.xlsx')

  console.log('→ Reading Task Statements.xlsx')
  const taskRows = readOnetSheet('Task Statements.xlsx')

  console.log('→ Reading Skills.xlsx')
  const skillRows = readOnetSheet('Skills.xlsx')

  console.log('→ Reading upstream empirical datasets')
  const eloundou = loadEloundouBeta()
  const economicIndex = loadEconomicIndex()
  const blsWages = loadBlsWages()
  const blsProjections = loadBlsProjections()

  const missingSources = []
  if (!eloundou) missingSources.push('eloundou-beta')
  if (!economicIndex) missingSources.push('economic-index')
  if (!blsWages) missingSources.push('bls-wages')
  if (!blsProjections) missingSources.push('bls-projections')
  if (missingSources.length > 0) {
    console.warn('')
    console.warn(`  ⚠ Missing data sources: ${missingSources.join(', ')}`)
    console.warn(
      '    The build will still produce onet.json, but occupations will use',
    )
    console.warn(
      '    SOC major-group averages or runtime fallback defaults for missing fields.',
    )
  }

  // Build base occupation records
  const occMap = new Map()
  for (const row of occRows) {
    const rawCode = String(row['O*NET-SOC Code'] ?? '').trim()
    if (!rawCode) continue
    occMap.set(rawCode, {
      code: rawCode,
      soc: normalizeSocCode(rawCode),
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

  // Collect tasks first (no β yet — β is occupation-level and attached after
  // we know the Eloundou value for the occupation's SOC code).
  let taskCount = 0
  for (const row of taskRows) {
    const code = String(row['O*NET-SOC Code'] ?? '').trim()
    const occ = occMap.get(code)
    if (!occ) continue
    const taskType = String(row['Task Type'] ?? '').trim()
    if (taskType !== 'Core') continue
    const text = String(row['Task'] ?? '').trim()
    if (!text) continue
    const idVal = Number(row['Task ID'])
    const id = Number.isFinite(idVal) ? idVal : null
    occ.tasks.push({ id, text, beta: null })
    taskCount++
  }

  // Skills
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
    const keep = filtered.length >= 5 ? filtered : list.slice(0, 8)
    occMap.get(code).skills = keep.map((s) => s.name)
  }

  // Pre-compute per-occupation observed_exposure from the Economic Index task
  // mappings: share of this occupation's core tasks whose normalized text
  // appears in the bundle of tasks observed in AI usage data.
  const observedExposureBySoc = new Map()
  if (economicIndex) {
    const observed = economicIndex.observedTaskTexts
    for (const occ of occMap.values()) {
      if (occ.tasks.length === 0) continue
      let matched = 0
      for (const task of occ.tasks) {
        const norm = normalizeTaskText(task.text)
        if (observed.has(norm)) matched++
      }
      observedExposureBySoc.set(occ.soc, matched / occ.tasks.length)
    }
  }

  // Precompute group averages and wage quartiles
  const eloundouGroupAvgs = eloundou ? computeGroupAverages(eloundou) : null
  const economicGroupAvgs = observedExposureBySoc.size > 0 ? computeGroupAverages(observedExposureBySoc) : null
  const wageGroupAvgs = blsWages ? computeGroupAverages(blsWages) : null
  const growthGroupAvgs = blsProjections ? computeGroupAverages(blsProjections) : null
  const wageQuartiles = computeWageQuartiles(blsWages)
  const quartileGroupAvgs = wageQuartiles ? computeGroupAverages(wageQuartiles) : null

  // Attach empirical fields to every occupation. Also back-fill per-task β
  // using the occupation-level Eloundou β (spread uniformly across tasks).
  const fallbackLog = []
  for (const occ of occMap.values()) {
    const fallbackFields = []
    const soc = occ.soc

    const occupationBeta = lookupWithFallback(
      eloundou,
      eloundouGroupAvgs,
      0.5,
      soc,
      fallbackFields,
      'occupation_beta',
    )

    // Back-fill per-task β with the occupation-level value. Eloundou's
    // task-level data isn't in this bundle, so per-task β ≡ occupation β.
    for (const task of occ.tasks) {
      task.beta = Number(occupationBeta.toFixed(4))
    }

    const observedExposure = lookupWithFallback(
      observedExposureBySoc.size > 0 ? observedExposureBySoc : null,
      economicGroupAvgs,
      0.3,
      soc,
      fallbackFields,
      'observed_exposure',
    )
    const medianWage = lookupWithFallback(
      blsWages,
      wageGroupAvgs,
      55000,
      soc,
      fallbackFields,
      'median_wage',
    )
    const rawQuartile = lookupWithFallback(
      wageQuartiles,
      quartileGroupAvgs,
      3,
      soc,
      fallbackFields.includes('median_wage') ? [] : fallbackFields,
      'wage_quartile',
    )
    const wageQuartile = Math.min(4, Math.max(1, Math.round(rawQuartile)))

    const growth = lookupWithFallback(
      blsProjections,
      growthGroupAvgs,
      3,
      soc,
      fallbackFields,
      'bls_projected_growth_pct',
    )

    const empirical = {
      occupation_beta: Number(occupationBeta.toFixed(4)),
      observed_exposure: Number(observedExposure.toFixed(4)),
      exposure_gap: Number((occupationBeta - observedExposure).toFixed(4)),
      median_wage: Math.round(medianWage),
      wage_quartile: wageQuartile,
      bls_projected_growth_pct: Number(growth.toFixed(2)),
    }
    if (fallbackFields.length > 0) {
      empirical.fallback_fields = [...new Set(fallbackFields)]
      fallbackLog.push({ soc, fields: empirical.fallback_fields })
    }
    occ.empirical = empirical
  }

  if (fallbackLog.length > 0) {
    console.log('')
    console.log(`  ⚠ ${fallbackLog.length} occupations used fallback values for 1+ fields`)
  }

  const occupations = [...occMap.values()]
    .filter((o) => o.tasks.length > 0 && o.title)
    .map(({ soc: _soc, ...rest }) => rest)
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
