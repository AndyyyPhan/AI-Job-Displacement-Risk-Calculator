# AI Job Displacement Risk Calculator

## Project Overview
A single-page web app that assesses automation risk for any job. The user inputs their job title and optional context; the system returns an automation risk score (0–100), a displacement timeline with confidence range, and personalized reskilling recommendations.

The scoring pipeline is anchored to published empirical data — Eloundou et al. (2023) task-level exposure ratings, Anthropic Economic Index observed-exposure measures, BLS wage statistics, and BLS employment projections — bundled at build time into the O*NET JSON. The LLM's role is to interpret and adjust these empirical baselines given the user's specific context, not to produce scores from scratch.

## Tech Stack
- **Framework:** React + TypeScript (Vite)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Visualization:** Bespoke SVG/CSS components (`RiskDial`, `Sparkbar`, `StepRail`, etc.) — no Recharts or other chart library. (`recharts` is still listed in `package.json` as a leftover dependency and can be removed.)
- **Validation:** Zod (validates structured JSON responses from Claude)
- **API:** Anthropic API (`claude-sonnet-4-5`) via `fetch`
- **Data:** Bundled O*NET Database enriched with external empirical datasets (see "Building the Enriched Dataset" below) — preprocessed into a static JSON file at build time
- **Build-time parsing:** `xlsx` (SheetJS) — dev dependency only
- **No backend** for v1 — Anthropic API calls made client-side

## Architecture: Multi-Agent Pipeline
Three sequential steps, each passing structured JSON to the next. Agent 1 is a pure code lookup that also computes an empirical baseline score; Agents 2 and 3 are LLM calls that interpret and adjust that baseline.

### Agent 1 — Job Researcher + Empirical Scorer (pure code, no LLM)
- **Input:** Job title + any user-supplied context
- **Tools:** None. Looks up the job in a bundled O*NET JSON dataset enriched with empirical data.
- **Task:** Fuzzy-match the user's free-text job title against O*NET occupation titles, alternate titles, and reported titles. Return the best matching SOC occupation's core tasks, high-importance skills, and all pre-computed empirical fields.
- **Why no LLM:** The prior version used `web_search` to scrape O*NET pages, which cost 100k+ input tokens per call and blew through our rate limit. Bundling the database gives us the same data for zero tokens. Bundling empirical datasets alongside it means the LLM doesn't need to recall statistics from training data.
- **Empirical fields computed in code (per occupation):**
  - `occupation_beta` — Eloundou et al. β score (0–1), the employment-weighted average of task-level β values for this SOC code. Represents the share of tasks theoretically exposed to LLMs.
  - `observed_exposure` — Anthropic Economic Index coverage score (0–1) from Massenkoff & McCrory (2026). Represents the share of tasks actually being performed by AI in professional settings.
  - `exposure_gap` — `occupation_beta - observed_exposure`. A large gap indicates adoption barriers (regulatory, trust, tooling) despite theoretical feasibility.
  - `median_wage` — BLS OEWS median annual wage for this SOC code.
  - `wage_quartile` — Which quartile (1–4) of the overall US wage distribution this occupation falls in. Computed deterministically from `median_wage` against the full SOC wage distribution.
  - `bls_projected_growth_pct` — BLS projected employment change (%) for 2024–2034.
  - `empirical_baseline_score` — A composite risk score (0–100) computed from the above fields before the LLM runs (see "Empirical Baseline Score" section below).
- **Empirical fields computed in code (per task):**
  - `beta` — Eloundou et al. task-level β (0, 0.5, or 1). Joined by O*NET task ID or, where IDs don't align, by semantic match against Eloundou's task descriptions.
- **Output (JSON):**
```json
{
  "job_title": string,
  "onet_match": string,           // "SOC code Title", e.g. "29-1224.00 Radiologists"
  "soc_major_group": string,      // 2-digit SOC major group, e.g. "29-0000" — used by Agent 3 to filter the resource registry
  "tasks": [{
    "name": string,
    "description": string,
    "beta": number                // 0, 0.5, or 1 — from Eloundou et al.
  }],
  "skills": [string],
  "additional_context": string,
  "empirical": {
    "occupation_beta": number,
    "observed_exposure": number,
    "exposure_gap": number,
    "median_wage": number,
    "wage_quartile": number,      // 1 (lowest) – 4 (highest)
    "bls_projected_growth_pct": number,
    "empirical_baseline_score": number, // 0–100
    "fallback_fields"?: string[]  // present only when onet.json shipped without empirical data for this occupation; lists which fields fell back to neutral defaults
  }
}
```
- **Match classification:** `matchOnetOccupation()` scores every occupation against the query and normalizes to a 0–1 confidence, then returns one of three result types that drive the UI:
  - `strong` — top confidence ≥ 0.85 (exact title / alt-title / reported-title hit), **or** top ≥ 0.70 with a ≥ 0.15 lead over the runner-up. The app auto-accepts and proceeds to task confirmation, always showing the matched occupation so the user knows what was selected.
  - `ambiguous` — at least one candidate with confidence ≥ 0.10 but not strong. The app pauses on a `JobMatchPicker` screen showing the top 5 candidates (title, SOC code, description, alt-titles, confidence) and lets the user pick.
  - `none` — no occupation scored above zero. The wrapper `researchJob()` throws `OnetNoMatchError` and the UI shows a friendly error with a "Start over" button.
- Downstream shape is identical on both the strong and ambiguous paths: the chosen occupation is fed through `buildJobProfileFromOccupation()` so Agents 2 and 3 receive the same `JobProfile` JSON regardless of how it was selected.

### Empirical Baseline Score

The `empirical_baseline_score` is computed in pure TypeScript inside Agent 1's code path, before any LLM call. It gives Agent 2 an empirical anchor to adjust rather than a blank slate to fill.

**Formula (provisional — tune weights based on validation):**
```
baseline = (
    0.40 × occupation_beta × 100       // theoretical exposure drives the base
  + 0.30 × observed_exposure × 100     // actual usage closes the gap
  + 0.15 × wage_tier_adjustment        // lower wages → earlier exposure
  + 0.15 × growth_adjustment           // negative BLS growth → higher risk
)
```

Where:
- `wage_tier_adjustment`: quartile 1 → 80, quartile 2 → 55, quartile 3 → 35, quartile 4 → 20. Based on the Anthropic report's finding that lower-wage occupations show earlier automation exposure.
- `growth_adjustment`: linearly maps BLS projected growth from the observed range (roughly −15% to +30%) onto 100–0, so strong negative growth maps to high risk and strong positive growth maps to low risk.

The score is clamped to 0–100. It is explicitly **not** a final answer — it's a starting point for Agent 2 to adjust. The results screen should display both the empirical baseline and the LLM-adjusted final score, with a clear label explaining the difference.

### Agent 2 — Risk Scorer (LLM, no tools)
- **Input:** Enriched job profile JSON from Agent 1, including per-task `beta` scores and occupation-level `empirical` block.
- **Tools:** None. Uses model knowledge only.
- **Task (revised):** Agent 2's job is now **contextual adjustment**, not scoring from scratch. The system prompt should frame it as:
  > "You are given an empirical baseline risk score of {empirical_baseline_score}/100 for this occupation, derived from published task-exposure data (Eloundou et al. 2023), real-world AI usage data (Anthropic Economic Index 2026), BLS wage statistics, and BLS employment projections. Each task also has a pre-computed β score indicating its theoretical LLM exposure. Your job is to adjust this baseline given the user's specific task mix and context. Explain where and why you diverge from the empirical baseline."
- **Bottleneck dimensions** (used for adjustment, not for producing the base score):
  1. **Novel problem-solving** (unstructured, creative, or context-dependent reasoning)
  2. **Social/interpersonal components** (negotiation, empathy, trust-building, caregiving)
  3. **Physical dexterity** (fine motor skills, unstructured physical environments)
  4. **API migration signal** — tasks with high `beta` AND high `observed_exposure` are likely already migrating to automated workflows, suggesting near-term transformation
- **What the LLM adds over the empirical baseline:**
  - Task-level rationales explaining *why* a specific task is harder or easier to automate than its β score suggests (e.g., "β=1 but this task requires real-time physical inspection that LLMs cannot perform")
  - Context adjustments based on the user's additional input (e.g., "mostly remote, heavy client calls" shifts the social-component weighting)
  - The augmentation/automation spectrum tags (`predicted_interaction_type`) which require qualitative judgment
- **Output (JSON):** (matches `agentRiskAssessmentSchema` in `src/agents/schemas.ts`)
```json
{
  "empirical_baseline_score": number,  // pass-through from Agent 1 for display
  "adjusted_risk_score": number,       // 0–100, LLM's final assessment
  "adjustment_rationale": string,      // why the LLM diverged from baseline
  "scored_tasks": [{
    "name": string,
    "beta": number,                    // pass-through from Agent 1
    "bottleneck_score": number,        // 0–100, higher = harder to automate
    "automation_risk": number,         // 0–100
    "rationale": string,
    "bottleneck_types": string[],
    "predicted_interaction_type": string
  }],
  "risk_rationale": string,
  "spectrum_summary": string
}
```
- **Not produced by Agent 2:** Timeline fields (`timeline_category`, `timeline_years_low`, `timeline_years_high`) are NOT in Agent 2's output schema. They are computed deterministically in code after Agent 2 returns (see "Timeline Window" below).

### Timeline Window (deterministic, post-Agent-2)

`computeTimelineWindow()` in `src/agents/empiricalScorer.ts` takes the occupation's `empirical` block plus Agent 2's `adjusted_risk_score` and returns `{ timeline_category, timeline_years_low, timeline_years_high }`. `App.tsx` merges this onto Agent 2's output to produce the full `RiskProfile` consumed by Agent 3 and the UI.

**Formula:**
```
midpoint = clamp(12
  + lerp(+3, -5, adoption_ratio)                  // high adoption pulls timeline in up to 5y
  + lerp(-3, +2, (bls_growth + 15) / 45)          // negative growth pulls timeline in ~3y
  + wage_adj,                                     // Q1: -2, Q2: -1, Q3: 0, Q4: +1
  2, 20)

where adoption_ratio = observed_exposure / max(occupation_beta, 0.01)

near_signals = count of: adoption_ratio > 0.6, bls_growth < 0,
                         wage_quartile ≤ 2, adjusted_risk_score ≥ 60
agreement    = max(near_signals, 4 − near_signals)   // 2, 3, or 4
half_width   = { 2: 4, 3: 3, 4: 2 }[agreement]       // wider band when signals disagree

timeline_years_low  = clamp(round(midpoint − half_width), 1, 18)
timeline_years_high = clamp(round(midpoint + half_width), 3, 25)

timeline_category =
  "near-term"  if midpoint ≤  6,
  "mid-term"   if midpoint ≤ 12,
  "long-term"  otherwise
```

The timeline is intentionally kept out of the LLM because (a) no published research produces calibrated per-occupation automation timelines, so the LLM would be guessing, and (b) a transparent, inspectable formula is easier to defend and tune than LLM output. The LLM's contribution to the timeline is funnelled through one input: its `adjusted_risk_score` is one of the four "near-term signals" that narrow or widen the confidence band.

### Conditional Agent 2 (optional optimization)
For occupations where the empirical data tells a clear, unambiguous story AND the user hasn't added significant custom context, Agent 2 can be skipped entirely. Criteria for skipping:
- `empirical_baseline_score` ≥ 85 or ≤ 15 (strongly one-directional signal)
- User did not modify the default O*NET task list on the confirmation screen
- User did not provide additional context beyond the job title
- All tasks have β = 1 or all tasks have β = 0 (no mixed signals)

When skipped, the app uses the empirical baseline directly and displays a note: "This score is based entirely on published employment data. For a more personalized assessment, add details about your specific role." This saves one full LLM call (~3–6k tokens) for the most clear-cut cases.

### Agent 3 — Reskilling Advisor (LLM, no tools)
- **Input:** Risk profile JSON from Agent 2 (or empirical baseline if Agent 2 was skipped) + original job profile from Agent 1 + bundled resource registry (see below)
- **Tools:** None. `web_search` has been removed to stay within the 75k token ceiling.
- **Task:** Identify transferable skills the user has, match them to lower-risk jobs, and recommend reskilling resources. The LLM selects from a **bundled resource registry** rather than searching the web at runtime.
- **Output (JSON):**
```json
{
  "transferable_skills": [string],
  "recommended_jobs": [{
    "title": string,
    "risk_score": number,
    "why_good_fit": string
  }],
  "resources": [{
    "registry_id": string,     // references an entry in the bundled registry
    "relevance": string        // LLM explains why this resource fits
  }],
  "meta_skill_recommendation": {
    "headline": string,                    // one-sentence plain-English hook
    "rationale": string,                   // 2–3 sentences on the Economic Index finding (~10% higher success for high-tenure AI users)
    "resources": [{                        // 2–3 selected resources from the registry, preferring Anthropic docs / DeepLearning.AI entries
      "registry_id": string,
      "relevance": string
    }]
  }
}
```

#### Bundled Resource Registry
The old Agent 3 used `web_search` to verify course URLs, which pulled full page content into context (~50–150k tokens per run). This was the single biggest cost driver and made the 75k ceiling impossible to hit.

The replacement is a static JSON registry (`src/data/resources.json`) curated at build time. Each entry has a verified URL, a title, a platform, a skill category, and a set of tags. The LLM's job is to pick relevant entries from the registry and explain their relevance — not to find or verify URLs.

**Registry structure:**
```json
[{
  "id": string,
  "title": string,
  "platform": "coursera" | "edx" | "mit_ocw" | "oreilly" | "khan_academy" | "udemy" | "linkedin_learning" | "anthropic_docs" | "deeplearning_ai" | "other",
  "url": string,              // verified at build time
  "skill_categories": [string], // e.g. ["data_analysis", "python", "statistics"]
  "occupational_families": [string], // SOC major groups this is relevant to, e.g. ["15-0000", "13-0000"]
  "type": "course" | "book" | "platform" | "certification" | "article",
  "level": "beginner" | "intermediate" | "advanced"
}]
```

**How the registry is built:**
1. Start with a manually curated seed list in `scripts/resources-seed.json` covering major reskilling pathways (coding, data analysis, project management, healthcare admin, trades, etc.), sourced from Coursera, edX, MIT OCW, O'Reilly, Khan Academy, LinkedIn Learning, Anthropic docs, and DeepLearning.AI. The last two categories exist specifically to support the `meta_skill_recommendation` on AI collaboration.
2. Verify every URL with a HEAD request in the build script. Drop any that return non-200 status.
3. Tag each resource with skill categories and relevant SOC major groups.
4. The registry ships as part of the build output. Refresh periodically (quarterly is fine — course catalogs change slowly).

**How Agent 3 uses it:**
- Agent 1 passes the SOC code's major group (first 2 digits) to Agent 3 alongside the risk profile.
- The Agent 3 prompt includes the subset of registry entries whose `occupational_families` match, trimmed to ~50 entries max. At ~100 tokens per entry, this adds ~5k tokens to context — versus 50–150k for `web_search`.
- The LLM picks 3–6 entries by `id` and writes a `relevance` explanation for each.
- The UI resolves `registry_id` → full entry (title, URL, platform) at render time.

**Tradeoff:** The resource recommendations are limited to what's in the registry. They won't include niche or newly-launched courses. This is an acceptable tradeoff for a ~10x reduction in token cost. Users who want more specific resources can follow the platform links and browse.

## User Flow
1. User enters job title + optional extra context (e.g., "I work in a hospital setting" or "mostly remote, heavy client calls")
2. Agent 1 classifies the match:
   - **Strong match:** app jumps straight to task confirmation, surfacing the matched occupation ("We matched your job to: *29-1224.00 Radiologists*")
   - **Ambiguous match:** app shows `JobMatchPicker` with the top 5 candidates; user picks one, then task confirmation continues with that choice
   - **No match:** friendly error with "Start over"
3. User confirms or adjusts task list on the task confirmation screen
4. Agent 1 computes `empirical_baseline_score` from bundled data
5. If conditional-skip criteria are met and the user hasn't customized: skip Agent 2, use `synthesizeRiskFromBaseline()` (deterministic code) to produce a RiskProfile directly from the empirical baseline
6. Otherwise: Agent 2 runs, adjusting the empirical baseline with contextual reasoning
7. `computeTimelineWindow()` runs (deterministic, pure code) against the occupation's empirical block plus the Agent 2 `adjusted_risk_score` — produces `timeline_category` / `timeline_years_low` / `timeline_years_high`, which are merged onto Agent 2's output to form the final `RiskProfile`
8. Agent 3 runs (Anthropic API call, no tools, selects from bundled resource registry)
9. Results screen shows:
   - **Empirical baseline** (from published data) alongside **adjusted score** (from LLM), with clear labels explaining each
   - Timeline range rendered inline in the `RiskScore` hero (e.g. "near-term · +3–7y"); no dedicated chart component
   - Per-task breakdown with β scores shown alongside LLM bottleneck assessments
   - Key empirical context: median wage, BLS projected growth, observed exposure %
   - Reskilling panel with job alternatives and resources

## Key Files
```
job-risk-calculator/
  data/                         # Raw inputs for build:data (all gitignored)
    onet-raw/                   # O*NET xlsx download — refresh from onetcenter.org
    eloundou-beta/              # Eloundou et al. task-level β scores
    economic-index/             # Anthropic Economic Index observed exposure
    bls-wages/                  # BLS OEWS wage data by SOC
    bls-projections/            # BLS employment projections 2024–2034
  scripts/
    build-onet-data.mjs         # Parses all five raw data sources → src/data/onet.json
    build-resources.mjs         # Reads resources-seed.json, URL-verifies, → src/data/resources.json
    resources-seed.json         # Hand-curated seed list consumed by build-resources.mjs
  src/
    agents/
      anthropicClient.ts        # Shared fetch wrapper + Zod retry + typed errors (AgentAPIError, AgentValidationError)
      schemas.ts                # All Zod schemas: jobProfile, agentRiskAssessment, riskProfile, reskillingPlan, resourceRegistry
      prompts.ts                # Agent 2 + Agent 3 system prompts
      jobResearcher.ts          # Agent 1 — delegates to src/lib/onet.ts (no LLM). Exports researchJob, finalizeJobResearch
      empiricalScorer.ts        # Pure code: computeEmpiricalBaselineScore, enrichEmpiricalContext, shouldSkipRiskScorer, synthesizeRiskFromBaseline, computeTimelineWindow
      riskScorer.ts             # Agent 2 LLM call — adjusts empirical baseline
      reskillingAdvisor.ts      # Agent 3 LLM call — selects from bundled resource registry
    components/
      JobInput.tsx              # Step 1: job title + context form
      JobMatchPicker.tsx        # Step 1b: shown only on ambiguous O*NET matches
      TaskConfirmation.tsx      # Step 2: confirm/edit O*NET tasks (shows β per task)
      RiskScore.tsx             # Results hero — dial + both scores + baseline-delta block + rationale blockquote + interaction-spectrum band. Timeline range rendered inline; no separate chart component.
      EmpiricalContext.tsx      # Displays wage, BLS growth, observed exposure data
      TaskBreakdown.tsx         # Per-task bottleneck cards (shows β alongside LLM scores)
      ReskillingPanel.tsx       # Job alternatives + resources (resolves registry_id → full entry)
      LoadingState.tsx          # Shared spinner with per-step label
      ErrorState.tsx            # Shared error display with retry
      ui/                       # Presentational primitives — no business logic
        AnimatedNumber.tsx      # Tweened number counter
        Chip.tsx                # Small capsule label
        Dateline.tsx            # Mono uppercase byline used throughout
        Grain.tsx               # Background noise texture overlay
        Kicker.tsx              # Section kicker label
        RiskDial.tsx            # Circular risk dial SVG (used for the primary score)
        Sparkbar.tsx            # Inline horizontal bar for comparing values
        StepRail.tsx            # Top-of-page phase indicator (intake → match → tasks → analysis → dossier)
    data/
      onet.json                 # Generated — 893 occupations, ~13k Core tasks, enriched with empirical data
      resources.json            # Generated — curated resource registry with verified URLs
    lib/
      onet.ts                   # Dynamic-import loader + ranked fuzzy matcher (strong/ambiguous/none) + buildJobProfileFromOccupation + getSocMajorGroup
      resourceRegistry.ts       # loadResourceRegistry, filterRegistryForProfile, resolveRegistryId
      formatters.ts             # riskColor, riskLabel, timelineLabel, formatDelta, parseSocCode
      cn.ts                     # Tiny className-join helper
    types/
      index.ts                  # Shared TypeScript types (z.infer from schemas) + Step discriminated union
    App.tsx                     # Step state machine, orchestrates agents (includes conditional skip logic + timeline merge)
    main.tsx
    index.css                   # @import "tailwindcss" + design tokens
    vite-env.d.ts               # ImportMetaEnv typing
  public/                       # Static assets served as-is
  dist/                         # Vite build output
  index.html
  vite.config.ts
  tsconfig*.json
  eslint.config.js
  package.json
  .env.example                  # Template showing VITE_ANTHROPIC_API_KEY
```

## Building the Enriched Dataset

The build script (`npm run build:data`) merges five data sources into a single `src/data/onet.json`:

### 1. O*NET Database (existing)
- Download from https://www.onetcenter.org/database.html
- Extract xlsx files into `data/onet-raw/`
- Parses `Occupation Data.xlsx`, `Task Statements.xlsx`, `Skills.xlsx`, `Alternate Titles.xlsx`, and `Sample of Reported Titles.xlsx`
- Filters to **Core** tasks only and keeps skills with Importance (IM) score ≥ 3.5

### 2. Eloundou et al. task-level β scores (new)
- **Source:** The dataset accompanies the paper "GPTs are GPTs" (Eloundou et al., 2023). Available via the paper's supplementary materials or GitHub.
- **Join key:** O*NET task ID where available; fall back to fuzzy text match on task descriptions for tasks that don't have exact ID alignment.
- **What it adds:** A `beta` field (0, 0.5, or 1) on each task, plus an occupation-level `occupation_beta` (employment-weighted average of task betas).
- Place source files in `data/eloundou-beta/`

### 3. Anthropic Economic Index observed exposure (new)
- **Source:** https://huggingface.co/datasets/Anthropic/EconomicIndex — published by Massenkoff & McCrory (2026).
- **Join key:** SOC code (6-digit O*NET-SOC maps to the dataset's occupation codes).
- **What it adds:** An `observed_exposure` field (0–1) on each occupation representing the share of tasks actually being performed by AI in work-related contexts.
- Place source files in `data/economic-index/`

### 4. BLS Wage Data (new)
- **Source:** BLS Occupational Employment and Wage Statistics (OEWS), latest annual release. Download from https://www.bls.gov/oes/tables.htm
- **Join key:** SOC code.
- **What it adds:** `median_wage` (annual) on each occupation. The build script also computes `wage_quartile` (1–4) against the full SOC wage distribution.
- Place source files in `data/bls-wages/`

### 5. BLS Employment Projections (new)
- **Source:** BLS Employment Projections, 2024–2034. Download from https://www.bls.gov/emp/tables.htm
- **Join key:** SOC code.
- **What it adds:** `bls_projected_growth_pct` on each occupation.
- Place source files in `data/bls-projections/`

### Build process
1. Download all five data sources into their respective `data/` subdirectories
2. Run `npm run build:data`
3. The script joins everything by SOC code, computes derived fields (`wage_quartile`, `exposure_gap`, `empirical_baseline_score`), and writes `src/data/onet.json`
4. All raw data folders are gitignored; only the generated JSON ships in the repo

Rerun whenever any upstream dataset gets a new release. The Anthropic Economic Index updates periodically; BLS wage data updates annually; BLS projections update roughly every two years; O*NET updates roughly annually.

## Environment Variables
```
VITE_ANTHROPIC_API_KEY=your_key_here
```
Add `.env` to `.gitignore`. Never commit the API key.

**Known v1 limitation:** `VITE_`-prefixed vars are inlined into the client bundle at build time. Anyone loading the page can read the key from DevTools. Use a personal dev key with a low spend cap set in the Anthropic console, and don't deploy this publicly without a backend proxy.

## Prompting Principles
- Every agent system prompt must instruct Claude to **return JSON only** — no preamble, no markdown fences
- Agent 2's system prompt must frame the task as **adjustment of an empirical baseline**, not scoring from scratch. The prompt should include the baseline score, explain its components, and ask the model to explain any divergences.
- Agent 2's system prompt must define the three bottleneck dimensions (novel problem-solving, social/interpersonal, physical dexterity) plus the API migration signal, with examples — but these are used to *explain* adjustments, not to produce the base score.
- Pass full prior agent output into the next agent's context to maintain coherence
- Use Zod to parse and validate every agent response; on parse failure, retry the call once before surfacing an error to the user. `anthropicClient.ts` handles this centrally — agents never retry themselves.

## Empirical Grounding

The project's scoring methodology draws on two primary sources and two supplementary government datasets:

### Primary Sources

**Eloundou et al. (2023) — "GPTs are GPTs: An Early Look at the Labor Market Impact Potential of Large Language Models"**
- Provides task-level β scores measuring theoretical LLM exposure for every O*NET task
- β = 1 means an LLM alone can halve the task's completion time; β = 0.5 means it can with additional tooling; β = 0 means it cannot
- These scores are bundled directly into `onet.json` and passed to Agent 2 as pre-computed data
- The paper finds ~80% of U.S. workers have at least 10% of tasks exposed; ~19% have over 50% exposed
- Higher-wage occupations tend to have higher exposure, unlike previous waves of automation technology

**Massenkoff & McCrory (2026) — "Labor Market Impacts of AI: A New Measure and Early Evidence" (Anthropic Economic Index)**
- Introduces "observed exposure" — measuring which theoretically-exposed tasks are *actually* being performed by AI in professional settings
- Key finding: actual AI coverage remains a fraction of theoretical capability (e.g., only 33% coverage in Computer & Math despite 94% theoretical feasibility)
- Tasks migrating from consumer AI use to automated API workflows are a leading indicator of imminent job transformation — this is operationalized as the API migration signal in Agent 2
- Lower-wage occupations show earlier automation exposure; higher-wage occupations are currently in augmentation phases — operationalized via the `wage_quartile` field
- No systematic increase in unemployment for highly exposed workers so far, though tentative evidence of slower hiring for workers aged 22–25 in exposed occupations
- The report classifies AI interactions into five types (directive, feedback loop, task iteration, validation, learning) — Agent 2 tags each task with a `predicted_interaction_type`
- High-tenure AI users show ~10% higher conversation success rates independent of task type — Agent 3 recommends AI collaboration skill development as a meta-skill

### Supplementary Data
- **BLS OEWS wage data** — used to compute `wage_quartile` deterministically rather than relying on the LLM's recall of salary data
- **BLS Employment Projections (2024–2034)** — occupations with higher observed AI exposure tend to have lower projected employment growth (Anthropic report, Figure 4). Bundled as `bls_projected_growth_pct` and displayed alongside AI risk scores to give users a government-sourced employment outlook.

### What the empirical data does NOT cover
- **Task reinstatement effects:** Acemoglu & Restrepo (2018, 2019) emphasize that automation also creates new labor-intensive tasks that partially offset displacement. Neither the β scores nor observed exposure capture this. The results screen should note this limitation.
- **Occupation-specific timelines:** No existing study produces calibrated predictions for *when* a specific occupation will be substantially automated. The timeline produced by `computeTimelineWindow()` is a transparent heuristic formula over the empirical inputs plus Agent 2's adjusted score — not an empirically calibrated forecast. The UI should clearly label it as such.
- **Non-LLM automation:** The Eloundou et al. β scores and Anthropic Economic Index measure LLM exposure specifically. Robotics, computer vision, and other AI modalities are not captured. Occupations with high physical-task content may face automation pressure from these other technologies that the empirical data here doesn't reflect.

## Cost / Rate-Limit Notes

**Hard ceiling: 75k input tokens per full run.**

Current token budget:
- **Agent 1:** 0 tokens (pure code lookup + empirical scoring)
- **Agent 2:** ~4–7k input tokens (no tools)
- **Agent 2 (skipped):** 0 tokens when conditional skip criteria are met
- **Agent 3:** ~8–15k input tokens (no tools; receives risk profile + ~50 filtered registry entries at ~100 tokens each)
- **Total:** ~12–22k input tokens per run (well within ceiling)

The old design had Agent 3 using `web_search`, which pulled full page content into context at 50–150k tokens per run — making any token ceiling impossible. Replacing `web_search` with a bundled resource registry drops Agent 3 from the dominant cost driver to a modest call comparable to Agent 2.

**Where the budget goes under worst case (~22k):**
| Component | Tokens | Notes |
|-----------|--------|-------|
| Agent 2 system prompt | ~1.5k | Bottleneck definitions, examples, instructions |
| Agent 2 user message (job profile + empirical data) | ~3–5k | ~15 tasks × ~200 tokens each + empirical block |
| Agent 2 output | ~1–2k | Scored tasks + rationales |
| Agent 3 system prompt | ~1k | Selection instructions |
| Agent 3 user message (risk profile + registry subset) | ~7–10k | Risk profile (~2k) + ~50 registry entries (~5k) |
| Agent 3 output | ~1–2k | Selected resources + rationales |

This leaves ~50k tokens of headroom against the 75k ceiling, which provides margin for: unusually large occupations with many tasks, Zod validation retries (each retry re-sends the full prompt), and any future prompt expansion.

**If you need to tighten further:** The registry subset can be filtered more aggressively (by 2-digit SOC group + skill overlap) to send fewer entries to Agent 3. At the extreme, you could pre-compute resource recommendations entirely in code using tag matching and skip Agent 3's LLM call for generic cases — but the LLM's ability to write relevant `why_good_fit` explanations is worth the tokens.

## Future / v2 Considerations
- Lightweight backend (Node/Express or FastAPI) to proxy the Anthropic API key before public deployment
- User accounts + saved results history
- Export results as PDF
- Periodic refresh of all bundled datasets (script already supports it via `npm run build:data`; add a checklist of upstream release cadences)
- Expand the resource registry beyond the initial ~100–200 entries; consider scraping course catalogs programmatically at build time with URL verification
- Validate empirical baseline formula weights against a held-out set of expert-scored occupations
- Consider bundling Frey & Osborne (2017) automation probabilities as an additional reference point (different methodology, broader automation scope beyond LLMs)
- Track how often Agent 2 diverges significantly from the empirical baseline — large systematic divergences may indicate the formula weights need recalibration
- Optional `web_search` toggle for Agent 3 behind a flag, for users on higher API tiers who want broader resource discovery (would blow past the 75k ceiling — document this clearly)
