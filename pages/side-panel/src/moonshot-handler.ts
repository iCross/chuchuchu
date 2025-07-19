import { type AskAssistantOptions } from './types';

type Message = {
  role: 'system' | 'assistant' | 'user';
  content: string;
};

const DEFAULT_MODEL = 'moonshot-v1-8k';
const DEFAULT_TEMPERATURE = 0;

type HandleMoonshotStreamParams = {
  systemPrompt: string;
  messages: Message[];
  options: AskAssistantOptions;
  abortController: AbortController;
  model?: string;
  temperature?: number;
  apiKey?: string;
  baseUrl?: string;
};

export const handleMoonshotStream = async ({
  systemPrompt,
  messages,
  options,
  abortController,
  model = DEFAULT_MODEL,
  temperature = DEFAULT_TEMPERATURE,
  apiKey,
  baseUrl = 'https://api.moonshot.cn/v1',
}: HandleMoonshotStreamParams) => {
  if (!apiKey) {
    throw new Error('Moonshot API key is required');
  }

  const apiUrl = `${baseUrl}/chat/completions`;
  console.log('🚀 Moonshot API Request:', {
    url: apiUrl,
    model: model,
    temperature: temperature,
    hasApiKey: !!apiKey,
  });

  let fullResponse = '';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
      max_tokens: 4096,
      top_p: 1,
      stream: true,
    }),
    signal: abortController.signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is null');

  const decoder = new TextDecoder();
  let buffer = '';

  let isReading = true;
  while (isReading) {
    const { done, value } = await reader.read();
    if (done) {
      isReading = false;
      break;
    }

    const chunk = decoder.decode(value);
    buffer += chunk;

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith('data: ')) {
        const data = trimmedLine.slice(6);
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content || '';
          if (content) {
            fullResponse += content;
            options.onUpdate?.(fullResponse);
          }
        } catch (e) {
          console.error('Error parsing JSON:', e, 'Line:', trimmedLine);
        }
      }
    }
  }

  return fullResponse;
};
