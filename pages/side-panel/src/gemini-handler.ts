import { type AskAssistantOptions } from './types';

type Message = {
  role: 'system' | 'assistant' | 'user';
  content: string;
};

const DEFAULT_MODEL = 'gemini-1.5-pro';
const DEFAULT_TEMPERATURE = 0;

type HandleGeminiStreamParams = {
  systemPrompt: string;
  messages: Message[];
  options: AskAssistantOptions;
  abortController: AbortController;
  model?: string;
  temperature?: number;
  apiKey?: string;
  baseUrl?: string;
};

export const handleGeminiStream = async ({
  systemPrompt,
  messages,
  options,
  abortController,
  model = DEFAULT_MODEL,
  temperature = DEFAULT_TEMPERATURE,
  apiKey,
  baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
}: HandleGeminiStreamParams) => {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const apiUrl = `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}`;

  // Convert OpenAI format messages to Gemini format
  const geminiMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // Add system prompt as the first message if provided
  if (systemPrompt) {
    geminiMessages.unshift({
      role: 'user',
      parts: [{ text: systemPrompt }],
    });
  }

  let fullResponse = '';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: geminiMessages,
      generationConfig: {
        temperature: temperature,
        topP: 0.7,
        thinkingConfig: {
          thinkingBudget: 1000,
        },
      },
    }),
    signal: abortController.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error! status: ${response.status}, message: ${errorText}`);
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

    // Process complete JSON objects as they arrive
    let openBraces = 0;
    let start = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '[') {
        // Start of array
        continue;
      }

      if (char === ']') {
        // End of array, we can ignore this
        continue;
      }

      if (char === '{') {
        if (openBraces === 0) start = i;
        openBraces++;
      } else if (char === '}') {
        openBraces--;
        if (openBraces === 0) {
          // Found a complete JSON object
          const jsonStr = buffer.slice(start, i + 1);
          try {
            const parsed = JSON.parse(jsonStr);
            const candidates = parsed.candidates;
            if (candidates && candidates.length > 0) {
              const content = candidates[0].content;
              if (content && content.parts && content.parts.length > 0) {
                const text = content.parts[0].text || '';
                if (text) {
                  fullResponse += text;
                  options.onUpdate?.(fullResponse);
                }
              }
            }
          } catch (e) {
            console.error('Error parsing Gemini JSON chunk:', e, 'JSON:', jsonStr);
          }

          // Remove processed part from buffer, including any comma after the object
          let nextStart = i + 1;
          while (
            nextStart < buffer.length &&
            (buffer[nextStart] === ',' ||
              buffer[nextStart] === '\n' ||
              buffer[nextStart] === ' ' ||
              buffer[nextStart] === '\t')
          ) {
            nextStart++;
          }
          buffer = buffer.slice(nextStart);
          i = -1; // Reset loop
          start = 0;
        }
      }
    }
  }

  // Process any remaining complete JSON in buffer
  if (buffer.trim()) {
    // Clean up buffer by removing array brackets and whitespace
    let cleanBuffer = buffer.trim();
    if (cleanBuffer.startsWith('[')) {
      cleanBuffer = cleanBuffer.slice(1);
    }
    if (cleanBuffer.endsWith(']')) {
      cleanBuffer = cleanBuffer.slice(0, -1);
    }
    cleanBuffer = cleanBuffer.trim();

    // Skip if only closing bracket or whitespace remains
    if (!cleanBuffer || cleanBuffer === ']' || cleanBuffer === ',') {
      return fullResponse;
    }

    try {
      const parsed = JSON.parse(cleanBuffer);
      const candidates = parsed.candidates;
      if (candidates && candidates.length > 0) {
        const content = candidates[0].content;
        if (content && content.parts && content.parts.length > 0) {
          const text = content.parts[0].text || '';
          if (text) {
            fullResponse += text;
            options.onUpdate?.(fullResponse);
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors for incomplete JSON at the end
      console.warn('Ignoring incomplete JSON at end of stream:', cleanBuffer);
    }
  }

  return fullResponse;
};
