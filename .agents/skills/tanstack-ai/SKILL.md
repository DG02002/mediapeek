---
name: tanstack-ai
description: Provider-agnostic, type-safe AI SDK for streaming, tool calling, structured output, and multimodal content.
---


## Overview

TanStack AI is a modular, provider-agnostic AI SDK with tree-shakeable adapters for OpenAI, Anthropic, Gemini, Ollama, and more. It provides streaming-first text generation, tool calling with approval workflows, structured output with Zod schemas, multimodal content support, and React hooks for chat/completion UIs.

**Core:** `@tanstack/ai`
**Vanilla Client:** `@tanstack/ai-client` (framework-agnostic)
**React:** `@tanstack/ai-react`
**Solid:** `@tanstack/ai-solid`
**Adapters:** `@tanstack/ai-openai`, `@tanstack/ai-anthropic`, `@tanstack/ai-gemini`, `@tanstack/ai-ollama`
**Languages:** TypeScript/JavaScript, PHP, Python
**Status:** Alpha

## Installation

```bash
npm install @tanstack/ai @tanstack/ai-react
# Or for framework-agnostic vanilla client:
npm install @tanstack/ai @tanstack/ai-client
# Provider adapters (install only what you need):
npm install @tanstack/ai-openai
npm install @tanstack/ai-anthropic
npm install @tanstack/ai-gemini
npm install @tanstack/ai-ollama
```

### PHP Installation

```bash
composer require tanstack/ai tanstack/ai-openai
```

### Python Installation

```bash
pip install tanstack-ai tanstack-ai-openai
```

## Core: generate()

```typescript
import { generate } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai/adapters'

const result = await generate({
  adapter: openaiText({ model: 'gpt-4o' }),
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain React hooks in 3 sentences.' },
  ],
})

// Streaming with async iteration
for await (const chunk of result) {
  process.stdout.write(chunk.text)
}
```

## Provider Adapters

```typescript
import { openaiText } from '@tanstack/ai-openai/adapters'
import { anthropicText } from '@tanstack/ai-anthropic/adapters'
import { geminiText } from '@tanstack/ai-gemini/adapters'
import { ollamaText } from '@tanstack/ai-ollama/adapters'

// OpenAI
const openai = openaiText({ model: 'gpt-4o' })

// Anthropic
const anthropic = anthropicText({ model: 'claude-sonnet-4-20250514' })

// Google Gemini
const gemini = geminiText({ model: 'gemini-pro' })

// Ollama (local)
const ollama = ollamaText({ model: 'llama3' })

// Runtime adapter switching
const adapter = process.env.AI_PROVIDER === 'anthropic' ? anthropic : openai
```

## React Hooks

### useChat

```tsx
import { useChat } from '@tanstack/ai-react'

function ChatUI() {
  const { messages, input, setInput, handleSubmit, isLoading } = useChat({
    adapter: openaiText({ model: 'gpt-4o' }),
  })

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  )
}
```

### useCompletion

```tsx
import { useCompletion } from '@tanstack/ai-react'

function CompletionUI() {
  const { completion, input, setInput, handleSubmit, isLoading } = useCompletion({
    adapter: openaiText({ model: 'gpt-4o' }),
  })

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter prompt..."
        />
        <button type="submit" disabled={isLoading}>Generate</button>
      </form>
      {completion && <div>{completion}</div>}
    </div>
  )
}
```

## Solid.js Hooks

```tsx
import { createChat } from '@tanstack/ai-solid'

function ChatUI() {
  const chat = createChat({
    adapter: openaiText({ model: 'gpt-4o' }),
  })

  return (
    <div>
      <For each={chat.messages()}>
        {(msg) => (
          <div>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        )}
      </For>
      <form onSubmit={chat.handleSubmit}>
        <input
          value={chat.input()}
          onInput={(e) => chat.setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" disabled={chat.isLoading()}>
          Send
        </button>
      </form>
    </div>
  )
}
```

## Vanilla Client

For framework-agnostic usage without React or Solid:

```typescript
import { createAIClient } from '@tanstack/ai-client'
import { openaiText } from '@tanstack/ai-openai/adapters'

const client = createAIClient({
  adapter: openaiText({ model: 'gpt-4o' }),
})

// Subscribe to state changes
client.subscribe((state) => {
  console.log('Messages:', state.messages)
  console.log('Loading:', state.isLoading)
})

// Send a message
await client.send('Hello, world!')

// Clear conversation
client.clear()
```

## Streaming

### Streaming Strategies

```typescript
import { generate } from '@tanstack/ai'

// Default: stream chunks as they arrive
const result = await generate({
  adapter: openaiText({ model: 'gpt-4o' }),
  messages: [...],
  stream: true,
})

for await (const chunk of result) {
  // Process each chunk
  console.log(chunk.text)
}
```

Available streaming strategies:
- **Batch** - Collect all chunks before delivery
- **Punctuation** - Stream at sentence boundaries
- **WordBoundary** - Stream at word boundaries
- **Composite** - Combine multiple strategies

### Server-Sent Events (SSE)

```typescript
// Server-side SSE endpoint
import { createReplayStream } from '@tanstack/ai'

export async function handler(req: Request) {
  const stream = createReplayStream({
    adapter: openaiText({ model: 'gpt-4o' }),
    messages: await req.json(),
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}
```

## Structured Output

```typescript
import { generate } from '@tanstack/ai'
import { convertZodToJsonSchema } from '@tanstack/ai'
import { z } from 'zod'

const RecipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.object({
    item: z.string(),
    amount: z.string(),
  })),
  steps: z.array(z.string()),
  cookTime: z.number(),
})

const result = await generate({
  adapter: openaiText({ model: 'gpt-4o' }),
  messages: [{ role: 'user', content: 'Give me a pasta recipe' }],
  schema: convertZodToJsonSchema(RecipeSchema),
})

// result is typed as z.infer<typeof RecipeSchema>
console.log(result.name, result.ingredients)
```

## Tool Calling

### Basic Tools

```typescript
import { generate } from '@tanstack/ai'

const result = await generate({
  adapter: openaiText({ model: 'gpt-4o' }),
  messages: [{ role: 'user', content: 'What is the weather in NYC?' }],
  tools: {
    getWeather: {
      description: 'Get weather for a location',
      parameters: z.object({
        location: z.string(),
        unit: z.enum(['celsius', 'fahrenheit']).optional(),
      }),
      execute: async ({ location, unit }) => {
        const data = await fetchWeather(location, unit)
        return data
      },
    },
  },
})
```

### Tool Calling with Approval Workflows

```typescript
import { ToolCallManager } from '@tanstack/ai'

const manager = new ToolCallManager({
  tools: {
    deleteUser: {
      description: 'Delete a user account',
      parameters: z.object({ userId: z.string() }),
      requiresApproval: true, // Requires human approval
      execute: async ({ userId }) => {
        await deleteUser(userId)
        return { success: true }
      },
    },
  },
  onApprovalRequired: async (toolCall) => {
    // Present to user for approval
    return await showApprovalDialog(toolCall)
  },
})
```

### Agentic Loop

```typescript
const result = await generate({
  adapter: openaiText({ model: 'gpt-4o' }),
  messages: [{ role: 'user', content: 'Research and summarize the topic' }],
  tools: { search, summarize, writeReport },
  maxIterations: 10, // Limit agent loop iterations
})
```

## Multimodal Content

```typescript
// Images
const result = await generate({
  adapter: openaiText({ model: 'gpt-4o' }),
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image_url', image_url: { url: 'https://example.com/photo.jpg' } },
    ],
  }],
})

// Image generation with DALL-E
import { openaiImage } from '@tanstack/ai-openai/adapters'

const image = await generate({
  adapter: openaiImage({ model: 'dall-e-3' }),
  messages: [{ role: 'user', content: 'A sunset over mountains' }],
})

// Image generation with Gemini Imagen
import { geminiImage } from '@tanstack/ai-gemini/adapters'

const image = await generate({
  adapter: geminiImage({ model: 'imagen-3' }),
  messages: [{ role: 'user', content: 'A futuristic cityscape at night' }],
})
```

## Thinking Models (Reasoning Tokens)

Support for models with extended reasoning/thinking capabilities:

```typescript
import { generate } from '@tanstack/ai'
import { anthropicText } from '@tanstack/ai-anthropic/adapters'

const result = await generate({
  adapter: anthropicText({ model: 'claude-sonnet-4-20250514' }),
  messages: [{ role: 'user', content: 'Solve this complex math problem step by step...' }],
  thinking: {
    enabled: true,
    budget: 10000, // Max thinking tokens
  },
})

// Access thinking/reasoning output
console.log('Thinking:', result.thinking)
console.log('Response:', result.text)

// Streaming with thinking tokens
for await (const chunk of result) {
  if (chunk.type === 'thinking') {
    console.log('[Thinking]', chunk.text)
  } else {
    process.stdout.write(chunk.text)
  }
}
```

## Message Utilities

```typescript
import { generateMessageId, normalizeToUIMessage } from '@tanstack/ai'

// Generate unique message IDs
const id = generateMessageId()

// Normalize provider-specific messages to UI format
const uiMessage = normalizeToUIMessage(providerMessage)
```

## Observability

```typescript
const result = await generate({
  adapter: openaiText({ model: 'gpt-4o' }),
  messages: [...],
  onEvent: (event) => {
    // Structured, typed events
    switch (event.type) {
      case 'text':
        console.log('Text chunk:', event.data)
        break
      case 'tool_call':
        console.log('Tool called:', event.name)
        break
      case 'error':
        console.error('Error:', event.error)
        break
    }
  },
})
```

## AI Devtools

TanStack AI includes a dedicated devtools panel for debugging AI workflows:

```tsx
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AIDevtoolsPanel } from '@tanstack/ai-react/devtools'

function App() {
  return (
    <TanStackDevtools
      plugins={[
        {
          id: 'ai',
          name: 'AI',
          render: () => <AIDevtoolsPanel />,
        },
      ]}
    />
  )
}
```

AI Devtools features:
- **Message Inspector** - View full conversation history with metadata
- **Token Usage** - Track input/output tokens and costs per request
- **Streaming Visualization** - Real-time view of streaming chunks
- **Tool Call Debugging** - Inspect tool calls, parameters, and results
- **Thinking/Reasoning Viewer** - Debug reasoning tokens from thinking models
- **Adapter Switching** - Test different providers in development
- **Request/Response Logs** - Full HTTP request/response inspection

## TanStack Start Integration

```typescript
// Shared implementation between AI tools and server functions
import { createServerFn } from '@tanstack/react-start'
import { generate } from '@tanstack/ai'

const aiChat = createServerFn({ method: 'POST' })
  .validator(z.object({ messages: z.array(messageSchema) }))
  .handler(async ({ data }) => {
    const result = await generate({
      adapter: openaiText({ model: 'gpt-4o' }),
      messages: data.messages,
    })
    return result
  })
```

## Partial JSON Parser

For streaming structured output that arrives incrementally:

```typescript
import { parsePartialJson } from '@tanstack/ai'

// Parse incomplete JSON during streaming
const partial = parsePartialJson('{"name": "Pasta", "ingredients": [{"item": "flour"')
// Returns: { name: "Pasta", ingredients: [{ item: "flour" }] }
```

## Best Practices

1. **Import only needed adapters** - tree-shakeable design minimizes bundle size
2. **Use structured output** with Zod schemas for type-safe AI responses
3. **Set `maxIterations`** on agentic loops to prevent runaway execution
4. **Use `requiresApproval`** for destructive tool calls
5. **Handle streaming errors** gracefully with try/catch around async iteration
6. **Use server functions** for API key security (never expose keys client-side)
7. **Use `onEvent`** for observability and debugging in development
8. **Switch adapters at runtime** for A/B testing or fallback strategies
9. **Use partial JSON parsing** for progressive UI updates during streaming
10. **Normalize messages** when switching between providers

## Common Pitfalls

- Exposing API keys in client-side code (use server functions)
- Not handling streaming errors (async iteration can throw)
- Forgetting `maxIterations` in agentic loops (can run indefinitely)
- Importing all adapters instead of just the one needed (bundle bloat)
- Not using structured output for data extraction (unreliable string parsing)
- Creating new adapter instances on every render (memoize or define at module level)
