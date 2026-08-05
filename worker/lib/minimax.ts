import Anthropic from '@anthropic-ai/sdk'

/**
 * MiniMax expone una API compatible con Anthropic, así que se usa el SDK de
 * Anthropic apuntando a su base URL. La key vive como secret del Worker y nunca
 * llega al cliente: esa es la única razón por la que este Worker existe.
 */
export const MINIMAX_BASE_URL = 'https://api.minimax.io/anthropic'
export const MINIMAX_MODEL = 'MiniMax-M3'

export class MinimaxError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message)
    this.name = 'MinimaxError'
  }
}

export function createMinimax(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, baseURL: MINIMAX_BASE_URL, maxRetries: 0, timeout: 90_000 })
}

/**
 * Pide una respuesta estructurada. Se fuerza el uso de la herramienta para que
 * el modelo devuelva JSON validado en vez de prosa con un bloque de código
 * dentro, que es donde se rompen estas integraciones.
 */
export async function callStructured(
  client: Anthropic,
  args: {
    system: string
    user: string
    toolName: string
    toolSchema: unknown
    maxTokens?: number
  },
): Promise<unknown> {
  let response
  try {
    response = await client.messages.create({
      model: MINIMAX_MODEL,
      max_tokens: args.maxTokens ?? 8000,
      system: args.system,
      messages: [{ role: 'user', content: args.user }],
      tools: [
        {
          name: args.toolName,
          description: 'Entrega el resultado en este formato exacto.',
          input_schema: args.toolSchema as Anthropic.Tool['input_schema'],
        },
      ],
      tool_choice: { type: 'tool', name: args.toolName },
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new MinimaxError(`MiniMax no respondió: ${detail}`)
  }

  const block = response.content.find((c) => c.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new MinimaxError('MiniMax respondió sin usar la herramienta pedida')
  }

  return block.input
}
