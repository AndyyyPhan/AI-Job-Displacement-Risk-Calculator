import type { z, ZodTypeAny } from 'zod'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 3072
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 1,
} as const

export class AgentValidationError extends Error {
  readonly agent: string
  readonly rawResponse: string
  readonly zodIssues: unknown

  constructor(agent: string, rawResponse: string, zodIssues: unknown) {
    super(`${agent} returned data that failed schema validation.`)
    this.name = 'AgentValidationError'
    this.agent = agent
    this.rawResponse = rawResponse
    this.zodIssues = zodIssues
  }
}

export class AgentAPIError extends Error {
  readonly agent: string
  readonly status: number
  readonly body: string

  constructor(agent: string, status: number, body: string) {
    super(`${agent} API call failed with status ${status}.`)
    this.name = 'AgentAPIError'
    this.agent = agent
    this.status = status
    this.body = body
  }
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: string; [key: string]: unknown }

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

interface CallOptions<S extends ZodTypeAny> {
  agentName: string
  systemPrompt: string
  userMessage: string
  schema: S
  webSearch?: boolean
}

export async function callAgent<S extends ZodTypeAny>(
  opts: CallOptions<S>,
): Promise<z.infer<S>> {
  const messages: AnthropicMessage[] = [
    { role: 'user', content: opts.userMessage },
  ]

  const firstRaw = await postMessage(opts, messages)
  const firstParsed = tryParse(opts.schema, firstRaw)
  if (firstParsed.ok) return firstParsed.data

  // Retry once, feeding the assistant's broken reply back and asking for valid JSON.
  messages.push({ role: 'assistant', content: firstRaw })
  messages.push({
    role: 'user',
    content: `Your previous response failed JSON schema validation. Validation error: ${JSON.stringify(
      firstParsed.error,
    )}. Respond again with valid JSON only — no prose, no markdown fences, nothing outside the JSON object.`,
  })
  const secondRaw = await postMessage(opts, messages)
  const secondParsed = tryParse(opts.schema, secondRaw)
  if (secondParsed.ok) return secondParsed.data

  throw new AgentValidationError(opts.agentName, secondRaw, secondParsed.error)
}

async function postMessage<S extends ZodTypeAny>(
  opts: CallOptions<S>,
  messages: AnthropicMessage[],
): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    throw new AgentAPIError(
      opts.agentName,
      0,
      'VITE_ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add a real key.',
    )
  }

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: opts.systemPrompt,
    messages,
  }
  if (opts.webSearch) {
    body.tools = [WEB_SEARCH_TOOL]
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new AgentAPIError(opts.agentName, response.status, errBody)
  }

  const data = (await response.json()) as { content?: ContentBlock[] }
  return extractText(data.content ?? [])
}

function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: unknown }

function tryParse<S extends ZodTypeAny>(
  schema: S,
  raw: string,
): ParseResult<z.infer<S>> {
  const cleaned = stripJsonFences(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    return { ok: false, error: `JSON.parse failed: ${(err as Error).message}` }
  }
  const result = schema.safeParse(parsed)
  if (result.success) return { ok: true, data: result.data }
  return { ok: false, error: result.error.issues }
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/
  const match = trimmed.match(fence)
  return match ? match[1].trim() : trimmed
}
