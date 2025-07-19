import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  useColorModeValue,
  Spinner,
  Box,
  Select as ChakraSelect,
} from '@chakra-ui/react';
import { useEffect, useState, useMemo } from 'react';
import { OLLAMA_API_ENDPOINT } from '@extension/shared';
import {
  customModelsStorage,
  type CustomModel,
  openAIKeyStorage,
  ollamaBaseUrlStorage,
  anthropicApiKeyStorage,
  groqApiKeyStorage,
  groqBaseUrlStorage,
  moonshotApiKeyStorage,
  moonshotBaseUrlStorage,
  geminiApiKeyStorage,
  geminiBaseUrlStorage,
} from './vars';

type Model = {
  name: string;
  size?: string;
  digest?: string;
  modified_at?: string;
};

type ModelOption = {
  value: string;
  label: string;
  isDisabled?: boolean;
};

type ModelType = 'ollama' | 'anthropic' | 'deepseek' | 'openai' | 'groq' | 'moonshot' | 'gemini';

const MODEL_TYPES = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'groq', label: 'Groq' },
  { value: 'moonshot', label: 'Moonshot' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'anthropic', label: 'Anthropic' },
  // To be added later:
  // { value: 'deepseek', label: 'DeepSeek' },
] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (model: string) => void;
};

export const ModelSelector = ({ isOpen, onClose, onSelect }: Props) => {
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
  const [selectedType, setSelectedType] = useState<ModelType>('openai');
  const [baseUrl, setBaseUrl] = useState(OLLAMA_API_ENDPOINT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqBaseUrl, setGroqBaseUrl] = useState('https://api.groq.com/openai/v1');
  const [moonshotApiKey, setMoonshotApiKey] = useState('');
  const [moonshotBaseUrl, setMoonshotBaseUrl] = useState('https://api.moonshot.cn/v1');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiBaseUrl, setGeminiBaseUrl] = useState('https://generativelanguage.googleapis.com/v1beta');

  // Create a list of already added model names
  const addedModelNames = useMemo(
    () => customModels.filter(model => model.type === selectedType).map(model => model.value.split('/')[1]),
    [customModels, selectedType],
  );

  const bg = useColorModeValue('dracula.light.background', 'dracula.background');
  const textColor = useColorModeValue('dracula.light.foreground', 'dracula.foreground');
  const isLight = useColorModeValue(true, false);

  useEffect(() => {
    const loadInitialState = async () => {
      const [
        savedBaseUrl,
        models,
        savedOpenAIKey,
        savedAnthropicKey,
        savedGroqKey,
        savedGroqBaseUrl,
        savedMoonshotKey,
        savedMoonshotBaseUrl,
        savedGeminiKey,
        savedGeminiBaseUrl,
      ] = await Promise.all([
        ollamaBaseUrlStorage.get(),
        customModelsStorage.get(),
        openAIKeyStorage.get(),
        anthropicApiKeyStorage.get(),
        groqApiKeyStorage.get(),
        groqBaseUrlStorage.get(),
        moonshotApiKeyStorage.get(),
        moonshotBaseUrlStorage.get(),
        geminiApiKeyStorage.get(),
        geminiBaseUrlStorage.get(),
      ]);

      setBaseUrl(savedBaseUrl);
      setCustomModels(models);
      setApiKey(savedOpenAIKey);
      setAnthropicApiKey(savedAnthropicKey);
      setGroqApiKey(savedGroqKey);
      setGroqBaseUrl(savedGroqBaseUrl);
      setMoonshotApiKey(savedMoonshotKey);
      setMoonshotBaseUrl(savedMoonshotBaseUrl);
      setGeminiApiKey(savedGeminiKey);
      setGeminiBaseUrl(savedGeminiBaseUrl);
    };

    if (isOpen) {
      loadInitialState();
    }
  }, [isOpen]);

  // Add back the storage effects to ensure keys are saved
  useEffect(() => {
    if (apiKey) {
      openAIKeyStorage.set(apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    if (anthropicApiKey) {
      anthropicApiKeyStorage.set(anthropicApiKey);
    }
  }, [anthropicApiKey]);

  useEffect(() => {
    if (groqApiKey) {
      groqApiKeyStorage.set(groqApiKey);
    }
  }, [groqApiKey]);

  useEffect(() => {
    if (groqBaseUrl) {
      groqBaseUrlStorage.set(groqBaseUrl);
    }
  }, [groqBaseUrl]);

  useEffect(() => {
    if (moonshotApiKey) {
      moonshotApiKeyStorage.set(moonshotApiKey);
    }
  }, [moonshotApiKey]);

  useEffect(() => {
    if (moonshotBaseUrl) {
      moonshotBaseUrlStorage.set(moonshotBaseUrl);
    }
  }, [moonshotBaseUrl]);

  useEffect(() => {
    if (geminiApiKey) {
      geminiApiKeyStorage.set(geminiApiKey);
    }
  }, [geminiApiKey]);

  useEffect(() => {
    if (geminiBaseUrl) {
      geminiBaseUrlStorage.set(geminiBaseUrl);
    }
  }, [geminiBaseUrl]);

  useEffect(() => {
    const fetchModels = async () => {
      if (selectedType === 'openai') {
        try {
          setIsLoading(true);
          setError(null);

          if (!apiKey) {
            setModelOptions([]);
            setSelectedModel(null);
            return;
          }

          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch OpenAI models: ${response.status} ${response.statusText}`);
          }

          const { data } = await response.json();
          const chatModels = data
            .filter(
              (model: { id: string }) =>
                // Exclude non-chat models
                !model.id.includes('audio') &&
                !model.id.includes('tts') &&
                !model.id.includes('whisper') &&
                !model.id.includes('computer-') &&
                !model.id.includes('text-embedding') &&
                !model.id.includes('babbage') &&
                !model.id.includes('transcribe') &&
                !model.id.startsWith('audio') &&
                !model.id.startsWith('tts') &&
                !model.id.startsWith('whisper') &&
                !model.id.startsWith('computer-') &&
                !model.id.startsWith('text-embedding') &&
                !model.id.startsWith('babbage') &&
                // Include chat models
                (model.id.startsWith('gpt-') || model.id.startsWith('o1-') || model.id.startsWith('o3-')),
            )
            .sort((a: { id: string }, b: { id: string }) => {
              // Sort GPT-4 models before GPT-3.5
              if (a.id.startsWith('gpt-4') && !b.id.startsWith('gpt-4')) return -1;
              if (!a.id.startsWith('gpt-4') && b.id.startsWith('gpt-4')) return 1;
              // Sort newer versions (with higher numbers) first
              return b.id.localeCompare(a.id);
            })
            .map((model: { id: string }) => ({
              value: model.id,
              label: model.id
                .replace('gpt-', 'GPT-')
                .replace('-turbo', ' Turbo')
                .replace('-preview', ' Preview')
                .replace(/-\d{4}/, '') // Remove date codes like -0125, -1106
                .trim(),
              isDisabled: addedModelNames.includes(model.id),
            }));

          setModelOptions(chatModels);
          const firstAvailable = chatModels.find((option: ModelOption) => !option.isDisabled);
          setSelectedModel(firstAvailable || null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch OpenAI models');
          setModelOptions([]);
          setSelectedModel(null);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (selectedType === 'groq') {
        try {
          setIsLoading(true);
          setError(null);

          if (!groqApiKey) {
            setModelOptions([]);
            setSelectedModel(null);
            return;
          }

          const response = await fetch(`${groqBaseUrl}/models`, {
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch Groq models: ${response.status} ${response.statusText}`);
          }

          const { data } = await response.json();
          const chatModels = data
            .filter(
              (model: { id: string }) =>
                // Include all Groq supported models based on official documentation
                model.id.includes('llama') ||
                model.id.includes('mixtral') ||
                model.id.includes('qwen') ||
                model.id.includes('deepseek') ||
                model.id.includes('gemma') ||
                model.id.includes('whisper') === false, // Exclude audio models
            )
            .sort((a: { id: string }, b: { id: string }) => {
              // Sort by model family, then by version
              const getFamily = (id: string) => {
                if (id.includes('llama')) return 1;
                if (id.includes('mixtral')) return 2;
                if (id.includes('qwen')) return 3;
                if (id.includes('deepseek')) return 4;
                if (id.includes('gemma')) return 5;
                return 6;
              };

              const familyDiff = getFamily(a.id) - getFamily(b.id);
              if (familyDiff !== 0) return familyDiff;

              return a.id.localeCompare(b.id);
            })
            .map((model: { id: string }) => ({
              value: model.id,
              label: model.id
                .replace(/meta-llama\//g, '')
                .replace(/mistralai\//g, '')
                .replace(/microsoft\//g, '')
                .replace(/google\//g, '')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim(),
              isDisabled: addedModelNames.includes(model.id),
            }));

          setModelOptions(chatModels);
          const firstAvailable = chatModels.find((option: ModelOption) => !option.isDisabled);
          setSelectedModel(firstAvailable || null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch Groq models');
          setModelOptions([]);
          setSelectedModel(null);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (selectedType === 'moonshot') {
        try {
          setIsLoading(true);
          setError(null);

          if (!moonshotApiKey) {
            setModelOptions([]);
            setSelectedModel(null);
            return;
          }

          const response = await fetch(`${moonshotBaseUrl}/models`, {
            headers: {
              Authorization: `Bearer ${moonshotApiKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch Moonshot models: ${response.status} ${response.statusText}`);
          }

          const { data } = await response.json();
          const chatModels = data
            .filter(
              (model: { id: string }) =>
                // Include Moonshot models
                model.id.includes('moonshot') || model.id.includes('v1'),
            )
            .sort((a: { id: string }, b: { id: string }) => {
              return a.id.localeCompare(b.id);
            })
            .map((model: { id: string }) => ({
              value: model.id,
              label: model.id
                .replace(/moonshot-/g, 'Moonshot ')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim(),
              isDisabled: addedModelNames.includes(model.id),
            }));

          setModelOptions(chatModels);
          const firstAvailable = chatModels.find((option: ModelOption) => !option.isDisabled);
          setSelectedModel(firstAvailable || null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch Moonshot models');
          setModelOptions([]);
          setSelectedModel(null);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (selectedType === 'gemini') {
        try {
          setIsLoading(true);
          setError(null);

          if (!geminiApiKey) {
            setModelOptions([]);
            setSelectedModel(null);
            return;
          }

          const response = await fetch(`${geminiBaseUrl}/models?key=${geminiApiKey}`);

          if (!response.ok) {
            throw new Error(`Failed to fetch Gemini models: ${response.status} ${response.statusText}`);
          }

          const { models } = await response.json();

          // Define the specific Gemini models we want to support
          const supportedGeminiModels = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite-preview-06-17'];

          const chatModels = models
            .filter((model: { name: string }) => {
              const modelId = model.name.replace('models/', '');
              return supportedGeminiModels.includes(modelId);
            })
            .sort((a: { name: string }, b: { name: string }) => {
              // Sort by priority: pro first, then flash, then flash-lite-preview
              const aId = a.name.replace('models/', '');
              const bId = b.name.replace('models/', '');

              const priority = (id: string) => {
                if (id === 'gemini-2.5-pro') return 1;
                if (id === 'gemini-2.5-flash') return 2;
                if (id === 'gemini-2.5-flash-lite-preview-06-17') return 3;
                return 4;
              };

              return priority(aId) - priority(bId);
            })
            .map((model: { name: string; displayName?: string }) => {
              const modelId = model.name.replace('models/', '');
              return {
                value: modelId,
                label:
                  model.displayName ||
                  modelId
                    .replace(/gemini-/g, 'Gemini ')
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase())
                    .trim(),
                isDisabled: addedModelNames.includes(modelId),
              };
            });

          setModelOptions(chatModels);
          const firstAvailable = chatModels.find((option: ModelOption) => !option.isDisabled);
          setSelectedModel(firstAvailable || null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch Gemini models');
          setModelOptions([]);
          setSelectedModel(null);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (selectedType === 'anthropic') {
        try {
          setIsLoading(true);
          setError(null);

          if (!anthropicApiKey) {
            setModelOptions([]);
            setSelectedModel(null);
            return;
          }

          const response = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch Anthropic models: ${response.status} ${response.statusText}`);
          }

          const { data } = await response.json();
          const chatModels = data
            .filter((model: { id: string }) => model.id.startsWith('claude-'))
            .map((model: { id: string; display_name: string }) => ({
              value: model.id,
              label: model.display_name,
              isDisabled: addedModelNames.includes(model.id),
            }))
            .sort((a: ModelOption, b: ModelOption) => {
              // Sort newer models first
              if (a.value.includes('3') && !b.value.includes('3')) return -1;
              if (!a.value.includes('3') && b.value.includes('3')) return 1;
              return b.value.localeCompare(a.value);
            });

          setModelOptions(chatModels);
          const firstAvailable = chatModels.find((option: ModelOption) => !option.isDisabled);
          setSelectedModel(firstAvailable || null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch Anthropic models');
          setModelOptions([]);
          setSelectedModel(null);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (selectedType !== 'ollama') {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const fetchedModels = data.models || [];

        // Create options with isDisabled flag
        const options = fetchedModels.map((model: Model) => ({
          value: model.name,
          label: model.name,
          isDisabled: addedModelNames.includes(model.name),
        }));

        setModelOptions(options);

        // Auto-select the first available model
        const firstAvailable = options.find((option: ModelOption) => !option.isDisabled);
        setSelectedModel(firstAvailable || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch models');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchModels();
    }
  }, [
    isOpen,
    selectedType,
    baseUrl,
    addedModelNames,
    apiKey,
    anthropicApiKey,
    groqApiKey,
    groqBaseUrl,
    moonshotApiKey,
    moonshotBaseUrl,
  ]);

  useEffect(() => {
    if (baseUrl !== OLLAMA_API_ENDPOINT) {
      ollamaBaseUrlStorage.set(baseUrl);
    }
  }, [baseUrl]);

  const handleSave = () => {
    if (selectedModel) {
      const modelExists = customModels.some(model => model.value === `${selectedType}/${selectedModel.value}`);

      if (modelExists) {
        setError('This model has already been added');
        return;
      }

      const newCustomModel: CustomModel = {
        value: `${selectedType}/${selectedModel.value}`,
        label: `${
          selectedType === 'openai'
            ? 'OpenAI'
            : selectedType === 'anthropic'
              ? 'Anthropic'
              : selectedType === 'groq'
                ? 'Groq'
                : selectedType === 'moonshot'
                  ? 'Moonshot'
                  : selectedType === 'gemini'
                    ? 'Gemini'
                    : 'Ollama'
        }: ${selectedModel.label}`,
        type: selectedType,
        baseUrl:
          selectedType === 'ollama'
            ? baseUrl
            : selectedType === 'groq'
              ? groqBaseUrl
              : selectedType === 'moonshot'
                ? moonshotBaseUrl
                : selectedType === 'gemini'
                  ? geminiBaseUrl
                  : undefined,
        apiKey:
          selectedType === 'openai'
            ? apiKey
            : selectedType === 'anthropic'
              ? anthropicApiKey
              : selectedType === 'groq'
                ? groqApiKey
                : selectedType === 'moonshot'
                  ? moonshotApiKey
                  : selectedType === 'gemini'
                    ? geminiApiKey
                    : undefined,
      };

      customModelsStorage.get().then(models => {
        const updatedModels = [...models, newCustomModel];
        customModelsStorage.set(updatedModels);
        setCustomModels(updatedModels);
      });

      onSelect(newCustomModel.value);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent bg={bg} color={textColor}>
        <ModalHeader>Select Model</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Type</FormLabel>
              <ChakraSelect
                value={selectedType}
                onChange={e => setSelectedType(e.target.value as ModelType)}
                bg={isLight ? 'white' : 'gray.700'}
                color={textColor}
                fontSize="sm">
                {MODEL_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </ChakraSelect>
            </FormControl>

            {selectedType === 'ollama' && (
              <FormControl>
                <FormLabel>Base URL</FormLabel>
                <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="Enter Ollama API URL" />
              </FormControl>
            )}

            {selectedType === 'openai' && (
              <FormControl isRequired>
                <FormLabel>API Key</FormLabel>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Enter your OpenAI API key"
                />
              </FormControl>
            )}

            {selectedType === 'anthropic' && (
              <FormControl isRequired>
                <FormLabel>API Key</FormLabel>
                <Input
                  type="password"
                  value={anthropicApiKey}
                  onChange={e => setAnthropicApiKey(e.target.value)}
                  placeholder="Enter your Anthropic API key"
                />
              </FormControl>
            )}

            {selectedType === 'groq' && (
              <>
                <FormControl>
                  <FormLabel>Base URL</FormLabel>
                  <Input
                    value={groqBaseUrl}
                    onChange={e => setGroqBaseUrl(e.target.value)}
                    placeholder="Enter Groq API base URL (default: https://api.groq.com/openai/v1)"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>API Key</FormLabel>
                  <Input
                    type="password"
                    value={groqApiKey}
                    onChange={e => setGroqApiKey(e.target.value)}
                    placeholder="Enter your Groq API key"
                  />
                </FormControl>
              </>
            )}

            {selectedType === 'moonshot' && (
              <>
                <FormControl>
                  <FormLabel>Base URL</FormLabel>
                  <Input
                    value={moonshotBaseUrl}
                    onChange={e => setMoonshotBaseUrl(e.target.value)}
                    placeholder="Enter Moonshot API base URL (default: https://api.moonshot.cn/v1)"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>API Key</FormLabel>
                  <Input
                    type="password"
                    value={moonshotApiKey}
                    onChange={e => setMoonshotApiKey(e.target.value)}
                    placeholder="Enter your Moonshot API key"
                  />
                </FormControl>
              </>
            )}

            {selectedType === 'gemini' && (
              <>
                <FormControl>
                  <FormLabel>Base URL</FormLabel>
                  <Input
                    value={geminiBaseUrl}
                    onChange={e => setGeminiBaseUrl(e.target.value)}
                    placeholder="Enter Gemini API base URL (default: https://generativelanguage.googleapis.com/v1beta)"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>API Key</FormLabel>
                  <Input
                    type="password"
                    value={geminiApiKey}
                    onChange={e => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key"
                  />
                </FormControl>
              </>
            )}

            <FormControl>
              <FormLabel>Model</FormLabel>
              {isLoading ? (
                <Box textAlign="center" py={4}>
                  <Spinner />
                </Box>
              ) : error ? (
                <Text color="red.500">{error}</Text>
              ) : (
                <ChakraSelect
                  value={selectedModel?.value || ''}
                  onChange={e => {
                    const option = modelOptions.find(opt => opt.value === e.target.value);
                    setSelectedModel(option || null);
                  }}
                  bg={isLight ? 'white' : 'gray.700'}
                  color={textColor}
                  fontSize="sm">
                  {modelOptions.map(option => (
                    <option key={option.value} value={option.value} disabled={option.isDisabled}>
                      {option.label}
                    </option>
                  ))}
                </ChakraSelect>
              )}
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} mr={3}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSave}
            isDisabled={
              !selectedModel ||
              (selectedType === 'openai' && !apiKey) ||
              (selectedType === 'anthropic' && !anthropicApiKey) ||
              (selectedType === 'groq' && !groqApiKey) ||
              (selectedType === 'moonshot' && !moonshotApiKey) ||
              (selectedType === 'gemini' && !geminiApiKey)
            }>
            Add Model
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
