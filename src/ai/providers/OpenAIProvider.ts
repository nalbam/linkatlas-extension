import {
  ANALYSIS_JSON_SCHEMA,
  RECATEGORIZE_JSON_SCHEMA,
  RECATEGORIZE_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  buildRecategorizeUserPrompt,
  buildUserPrompt,
  parseAnalysisContent,
  parseRecategorizeContent,
} from '../prompts'
import {
  type AIProvider,
  type AnalyzeInput,
  type BookmarkAnalysis,
  type RecategorizeAssignment,
  type RecategorizeInput,
} from '../types'

const DEFAULT_MODEL = 'gpt-4o-mini'
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

// Per-bookmark analysis is a small fixed object; one assignment is ~12-20 tokens,
// so size the recategorize cap to the chunk plus headroom (and never unbounded).
const ANALYZE_MAX_TOKENS = 1024
const RECATEGORIZE_TOKENS_PER_INPUT = 20
const RECATEGORIZE_MAX_TOKENS_CAP = 16384

function recategorizeMaxTokens(inputCount: number): number {
  return Math.min(RECATEGORIZE_MAX_TOKENS_CAP, inputCount * RECATEGORIZE_TOKENS_PER_INPUT + 256)
}

interface OpenAIProviderOptions {
  model?: string
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
  endpoint?: string
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/**
 * OpenAI implementation of {@link AIProvider} using Chat Completions with
 * Structured Outputs (`response_format: json_schema`) so the model is forced to
 * return a schema-valid analysis object. The request building and the response
 * parsing are pure (see `../prompts`), making this client easy to test.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const
  readonly label = 'OpenAI'

  private readonly model: string
  private readonly fetchImpl: typeof fetch
  private readonly endpoint: string

  constructor(
    private readonly apiKey: string,
    options: OpenAIProviderOptions = {},
  ) {
    this.model = options.model ?? DEFAULT_MODEL
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
    this.endpoint = options.endpoint ?? ENDPOINT
  }

  async analyzeBookmark(
    input: AnalyzeInput,
    options: { signal?: AbortSignal } = {},
  ): Promise<BookmarkAnalysis> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: options.signal,
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: ANALYZE_MAX_TOKENS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input) },
        ],
        response_format: { type: 'json_schema', json_schema: ANALYSIS_JSON_SCHEMA },
      }),
    })

    const data = (await response.json()) as ChatCompletionResponse
    if (!response.ok) {
      throw new Error(data.error?.message ?? `OpenAI request failed (${response.status})`)
    }

    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenAI returned an empty response')
    return parseAnalysisContent(content)
  }

  async recategorize(
    inputs: RecategorizeInput[],
    options: { targetCount?: number; signal?: AbortSignal; existingCategories?: string[] } = {},
  ): Promise<RecategorizeAssignment[]> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: options.signal,
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: recategorizeMaxTokens(inputs.length),
        messages: [
          { role: 'system', content: RECATEGORIZE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildRecategorizeUserPrompt(inputs, options.targetCount, options.existingCategories),
          },
        ],
        response_format: { type: 'json_schema', json_schema: RECATEGORIZE_JSON_SCHEMA },
      }),
    })

    const data = (await response.json()) as ChatCompletionResponse
    if (!response.ok) {
      throw new Error(data.error?.message ?? `OpenAI request failed (${response.status})`)
    }

    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenAI returned an empty response')
    return parseRecategorizeContent(content)
  }
}
