import {
  ANALYSIS_JSON_SCHEMA,
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseAnalysisContent,
} from '../prompts'
import { type AIProvider, type AnalyzeInput, type BookmarkAnalysis } from '../types'

const DEFAULT_MODEL = 'gpt-4o-mini'
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

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

  async analyzeBookmark(input: AnalyzeInput): Promise<BookmarkAnalysis> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
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
}
