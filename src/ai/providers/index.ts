import { type AIProvider, type ProviderId } from '../types'
import { OpenAIProvider } from './OpenAIProvider'

export class ProviderNotImplementedError extends Error {
  constructor(public readonly providerId: ProviderId) {
    super(`The "${providerId}" provider is not implemented yet.`)
    this.name = 'ProviderNotImplementedError'
  }
}

/**
 * Factory for AI providers. OpenAI is fully implemented; Gemini and Claude
 * share the same `AIProvider` contract and slot in here in a later phase.
 */
export function createProvider(id: ProviderId, apiKey: string): AIProvider {
  switch (id) {
    case 'openai':
      return new OpenAIProvider(apiKey)
    case 'gemini':
    case 'claude':
      throw new ProviderNotImplementedError(id)
  }
}
