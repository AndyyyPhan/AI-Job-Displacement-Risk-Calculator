# AI Job Displacement Risk Calculator

## Project Overview
A single-page web app that assesses automation risk for any job. The user inputs their job title and optional context; the system returns an automation risk score (0–100), a displacement timeline with confidence range, and personalized reskilling recommendations.

## Tech Stack
- **Framework:** React + TypeScript (Vite)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Charts:** Recharts (timeline visualization with confidence band)
- **Validation:** Zod (validates structured JSON responses from Claude)
- **API:** Anthropic API (`claude-sonnet-4-5`) via `fetch`
- **Data:** Bundled O*NET Database (tasks, skills, alternate titles) — preprocessed from the official xlsx download into a static JSON file at build time
- **Build-time parsing:** `xlsx` (SheetJS) — dev dependency only
- **No backend** for v1 — Anthropic API calls made client-side

## Architecture: Multi-Agent Pipeline
Three sequential steps, each passing structured JSON to the next. Agent 1 is a pure code lookup; Agents 2 and 3 are LLM calls.

### Agent 1 — Job Researcher (pure code, no LLM)
- **Input:** Job title + any user-supplied context
- **Tools:** None. Looks up the job in a bundled O*NET JSON dataset.
- **Task:** Fuzzy-match the user's free-text job title against O*NET occupation titles, alternate titles, and reported titles. Return the best matching SOC occupation's Core tasks and high-importance skills.
- **Why no LLM:** The prior version used `web_search` to scrape O*NET pages, which cost 100k+ input tokens per call and blew through our rate limit. Bundling the database gives us the same data for zero tokens.
- **Output (JSON — shape unchanged from v1 so downstream agents don't care):**
```json
{
  "job_title": string,
  "onet_match": string,       // "SOC code Title", e.g. "29-1224.00 Radiologists"
  "tasks": [{ "name": string, "description": string }],
  "skills": [string],
  "additional_context": string
}
```
- **Failure mode:** if no occupation matches the query, throws `OnetNoMatchError` and the UI shows a friendly error with a "Start over" button.

### Agent 2 — Risk Scorer (LLM, no tools)
- **Input:** Job profile JSON from Agent 1
- **Tools:** None. Uses model knowledge only — web_search removed to stay under our rate limit.
- **Task:** Score each task on "bottleneckedness" — how hard it is to automate — using three bottleneck dimensions:
  1. **Novel problem-solving** (unstructured, creative, or context-dependent reasoning)
  2. **Social/interpersonal components** (negotiation, empathy, trust-building, caregiving)
  3. **Physical dexterity** (fine motor skills, unstructured physical environments)
- Aggregate task scores into an overall risk score and timeline estimate.
- **Output (JSON):**
```json
{
  "overall_risk_score": number, // 0–100
  "timeline_category": "near-term" | "mid-term" | "long-term",
  "timeline_years_low": number,
  "timeline_years_high": number,
  "scored_tasks": [{
    "name": string,
    "bottleneck_score": number, // 0–100, higher = harder to automate
    "automation_risk": number, // 0–100
    "rationale": string,
    "bottleneck_types": string[]
  }],
  "risk_rationale": string
}
```

### Agent 3 — Reskilling Advisor (LLM, no tools)
- **Input:** Risk profile JSON from Agent 2 + original job profile from Agent 1
- **Tools:** None. Web_search removed — resource URLs come from model memory.
- **Task:** Identify transferable skills the user has, match them to lower-risk jobs, and recommend reskilling resources. The prompt explicitly steers the model toward canonical platforms (Coursera, MIT OCW, edX, O'Reilly, etc.) and prefers platform root URLs over deep links to avoid hallucinated URLs.
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
    "title": string,
    "type": "course" | "book" | "platform" | "article",
    "url": string,
    "relevance": string
  }]
}
```
- **Known tradeoff:** without `web_search`, some resource URLs may be slightly wrong. If that becomes a problem, flip `webSearch: true` in `src/agents/reskillingAdvisor.ts` — the client already supports it (`max_uses: 1`).

## User Flow
1. User enters job title + optional extra context (e.g., "I work in a hospital setting" or "mostly remote, heavy client calls")
2. Agent 1 looks up the O*NET entry from bundled JSON (instant) → app shows the matched tasks and asks user to confirm/edit ("Is this what you actually do?")
3. User confirms or adjusts task list
4. Agents 2 and 3 run sequentially (Anthropic API calls)
5. Results screen shows:
   - Risk score (0–100 with label)
   - Timeline chart (Recharts line with confidence band / shaded area)
   - Per-task breakdown with bottleneck explanations
   - Reskilling panel with job alternatives and resources

## Key Files
```
job-risk-calculator/
  data/
    onet-raw/                   # O*NET xlsx download (gitignored — refresh from onetcenter.org)
  scripts/
    build-onet-data.mjs         # Parses xlsx → src/data/onet.json
  src/
    agents/
      anthropicClient.ts        # Shared fetch wrapper + Zod retry + typed errors
      schemas.ts                # All three Zod schemas in one file
      prompts.ts                # Agent 2 + Agent 3 system prompts
      jobResearcher.ts          # Agent 1 — delegates to src/lib/onet.ts (no LLM)
      riskScorer.ts             # Agent 2 LLM call
      reskillingAdvisor.ts      # Agent 3 LLM call
    components/
      JobInput.tsx              # Step 1: job title + context form
      TaskConfirmation.tsx      # Step 2: confirm/edit O*NET tasks
      RiskScore.tsx             # Score display + label
      TimelineChart.tsx         # Recharts ComposedChart with sigmoid curve + confidence band
      TaskBreakdown.tsx         # Per-task bottleneck cards
      ReskillingPanel.tsx       # Job alternatives + resources
      LoadingState.tsx          # Shared spinner with per-step label
      ErrorState.tsx            # Shared error display with retry
    data/
      onet.json                 # Generated — 893 occupations, ~13k Core tasks (~3.4 MB / ~850 KB gzipped)
    lib/
      onet.ts                   # Dynamic-import loader + fuzzy title matcher
    types/
      index.ts                  # Shared TypeScript types (z.infer from schemas)
    App.tsx                     # Step state machine, orchestrates agents
    main.tsx
    index.css                   # @import "tailwindcss"
    vite-env.d.ts               # ImportMetaEnv typing
```

## Building the O*NET Dataset
1. Download the O*NET Database (Excel format) from https://www.onetcenter.org/database.html
2. Extract all xlsx files into `job-risk-calculator/data/onet-raw/`
3. Run `npm run build:data` — parses `Occupation Data.xlsx`, `Task Statements.xlsx`, `Skills.xlsx`, `Alternate Titles.xlsx`, and `Sample of Reported Titles.xlsx` into `src/data/onet.json`
4. The raw folder is gitignored; only the generated JSON ships in the repo

The build script filters to **Core** tasks only and keeps skills with Importance (IM) score ≥ 3.5. Rerun whenever O*NET ships a new release.

## Environment Variables
```
VITE_ANTHROPIC_API_KEY=your_key_here
```
Add `.env` to `.gitignore`. Never commit the API key.

**Known v1 limitation:** `VITE_`-prefixed vars are inlined into the client bundle at build time. Anyone loading the page can read the key from DevTools. Use a personal dev key with a low spend cap set in the Anthropic console, and don't deploy this publicly without a backend proxy.

## Prompting Principles
- Every agent system prompt must instruct Claude to **return JSON only** — no preamble, no markdown fences
- Scoring agent system prompt must explicitly define the three bottleneck dimensions with examples
- Pass full prior agent output into the next agent's context to maintain coherence
- Use Zod to parse and validate every agent response; on parse failure, retry the call once before surfacing an error to the user. `anthropicClient.ts` handles this centrally — agents never retry themselves.

## Cost / Rate-Limit Notes
Current token budget per full run:
- **Agent 1:** 0 tokens (pure code lookup)
- **Agent 2:** ~3–6k input tokens
- **Agent 3:** ~4–8k input tokens
- **Total:** ~10–15k input tokens per run

This fits comfortably under Tier 1 Anthropic limits (30k ITPM). If you re-enable `web_search` anywhere, expect 50k–150k extra input tokens per call because search results fetch full page content into context.

## Future / v2 Considerations
- Lightweight backend (Node/Express or FastAPI) to proxy the Anthropic API key before public deployment
- User accounts + saved results history
- Export results as PDF
- Periodic O*NET database refresh (script already supports it via `npm run build:data`)
- Optional `web_search` on Agent 3 with `max_uses: 1` if resource URLs start hallucinating in practice
