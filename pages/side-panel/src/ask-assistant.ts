import { handleGroqStream, handleGroqOfficialStream } from './groq-handler';
import { handleOllamaStream } from './ollama-handler';
import { handleOpenAIStream } from './openai-handler';
import { handleAnthropicStream } from './anthropic-handler';
import { handleMoonshotStream } from './moonshot-handler';
import { handleGeminiStream } from './gemini-handler';
import { type AskAssistantOptions } from './types';
import {
  groqApiKeyStorage,
  groqBaseUrlStorage,
  moonshotApiKeyStorage,
  moonshotBaseUrlStorage,
  geminiApiKeyStorage,
  geminiBaseUrlStorage,
  customModelsStorage,
} from '../../options/src/vars';

type GroqMessageContent = {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
};

type GroqMessage = {
  role: 'system' | 'assistant' | 'user';
  content: string | GroqMessageContent[];
};

type StandardMessage = {
  role: 'system' | 'assistant' | 'user';
  content: string;
};

type AskAssistantParams = {
  systemPrompt: string;
  userPrompt: string;
  previousMessages?: StandardMessage[];
  options: AskAssistantOptions;
  model?: string;
  temperature?: number;
  screenshot?: string;
};

export const askAssistant = async ({
  systemPrompt,
  userPrompt,
  previousMessages = [],
  options,
  model = 'llama-3.1-8b-instant',
  temperature,
  screenshot,
}: AskAssistantParams) => {
  const abortController = new AbortController();

  try {
    // If screenshot is provided, use meta-llama/llama-4-scout-17b-16e-instruct model
    const actualModel = screenshot
      ? 'meta-llama/llama-4-scout-17b-16e-instruct'
      : model?.toLowerCase().startsWith('ollama/')
        ? model.replace(/^ollama\//i, '')
        : model?.toLowerCase().startsWith('openai/')
          ? model.replace(/^openai\//i, '')
          : model?.toLowerCase().startsWith('anthropic/')
            ? model.replace(/^anthropic\//i, '')
            : model?.toLowerCase().startsWith('groq/')
              ? model.replace(/^groq\//i, '')
              : model?.toLowerCase().startsWith('moonshot/')
                ? model.replace(/^moonshot\//i, '')
                : model?.toLowerCase().startsWith('gemini/')
                  ? model.replace(/^gemini\//i, '')
                  : model;

    let fullResponse: string;

    const messages: StandardMessage[] = [
      ...previousMessages,
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    if (screenshot) {
      // Create message with screenshot for Groq
      const userMessage: GroqMessage = {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          {
            type: 'image_url',
            image_url: {
              url: screenshot,
            },
          },
        ],
      };

      const groqMessages: GroqMessage[] = [
        ...previousMessages.map(msg => ({
          ...msg,
          content: typeof msg.content === 'string' ? msg.content : (msg.content as GroqMessageContent[])[0].text || '',
        })),
        userMessage,
      ];

      // Use Groq for meta-llama model
      fullResponse = await handleGroqStream({
        systemPrompt,
        messages: groqMessages,
        options,
        abortController,
        model: actualModel,
        temperature,
      });
    } else if (model?.toLowerCase().startsWith('groq/')) {
      // Check if this is an official Groq model (has API key configured)
      const [groqApiKey, groqBaseUrl, customModels] = await Promise.all([
        groqApiKeyStorage.get(),
        groqBaseUrlStorage.get(),
        customModelsStorage.get(),
      ]);

      const isOfficialGroqModel = customModels.some(m => m.value === model && m.type === 'groq' && m.apiKey);

      if (isOfficialGroqModel && groqApiKey) {
        // Use official Groq API
        fullResponse = await handleGroqOfficialStream({
          systemPrompt,
          messages,
          options,
          abortController,
          model: actualModel,
          temperature,
          apiKey: groqApiKey,
          baseUrl: groqBaseUrl,
        });
      } else {
        // Fallback to original Groq handler (Cloud Function)
        fullResponse = await handleGroqStream({
          systemPrompt,
          messages,
          options,
          abortController,
          model: actualModel,
          temperature,
        });
      }
    } else if (model?.toLowerCase().startsWith('ollama/')) {
      fullResponse = await handleOllamaStream({
        systemPrompt,
        messages,
        options,
        abortController,
        model: actualModel,
        temperature,
      });
    } else if (model?.toLowerCase().startsWith('openai/')) {
      fullResponse = await handleOpenAIStream({
        systemPrompt,
        messages,
        options,
        abortController,
        model: actualModel,
        temperature,
      });
    } else if (model?.toLowerCase().startsWith('anthropic/')) {
      fullResponse = await handleAnthropicStream({
        systemPrompt,
        messages,
        options,
        abortController,
        model: actualModel,
        temperature,
      });
    } else if (model?.toLowerCase().startsWith('moonshot/')) {
      // Use Moonshot API
      const [moonshotApiKey, moonshotBaseUrl, customModels] = await Promise.all([
        moonshotApiKeyStorage.get(),
        moonshotBaseUrlStorage.get(),
        customModelsStorage.get(),
      ]);

      const moonshotModel = customModels.find(m => m.value === model && m.type === 'moonshot');
      const apiKey = moonshotModel?.apiKey || moonshotApiKey;

      if (!apiKey) {
        throw new Error('Moonshot API key is required');
      }

      fullResponse = await handleMoonshotStream({
        systemPrompt,
        messages,
        options,
        abortController,
        model: actualModel,
        temperature,
        apiKey,
        baseUrl: moonshotBaseUrl,
      });
    } else if (model?.toLowerCase().startsWith('gemini/')) {
      // Use Gemini API
      const [geminiApiKey, geminiBaseUrl, customModels] = await Promise.all([
        geminiApiKeyStorage.get(),
        geminiBaseUrlStorage.get(),
        customModelsStorage.get(),
      ]);

      const geminiModel = customModels.find(m => m.value === model && m.type === 'gemini');
      const apiKey = geminiModel?.apiKey || geminiApiKey;

      if (!apiKey) {
        throw new Error('Gemini API key is required');
      }

      fullResponse = await handleGeminiStream({
        systemPrompt,
        messages,
        options,
        abortController,
        model: actualModel,
        temperature,
        apiKey,
        baseUrl: geminiBaseUrl,
      });
    } else {
      fullResponse = await handleGroqStream({
        systemPrompt,
        messages,
        options,
        abortController,
        model: actualModel,
        temperature,
      });
    }

    // Check if response is empty or only whitespace
    if (!fullResponse?.trim()) {
      throw new Error('Empty response received');
    }

    options.onComplete?.(fullResponse);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        options.onAbort?.();
      } else {
        console.error('Error in askAssistant:', error);
        options.onError?.(error);
      }
    }
  }

  return abortController;
};
