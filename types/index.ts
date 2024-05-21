export interface OpenAIModel {
  id: string;
  name: string;
}

export enum ModelID {
  OPENAI_GPT_3_5_16 = 'gpt-3.5-turbo-16k',
  OPENAI_GPT_3_5 = 'gpt-3.5-turbo',
  OPENAI_GPT_4 = 'gpt-4',
  OLLAMA_LLAMA_3 = 'llama3',
  OLLAMA_PHI_3 = 'phi3'
}

export enum ModelType {
  OPENAI = 'OPENAI',
  AZURE_OPENAI = 'AZURE_OPENAI',
  OLLAMA = 'OLLAMA',
}

export const AIModels: Record<ModelID, OpenAIModel> = {
  [ModelID.OPENAI_GPT_3_5_16]: {
    id: ModelID.OPENAI_GPT_3_5_16,
    name: 'GPT-3.5 Turbo 16k',
  },
  [ModelID.OPENAI_GPT_3_5]: {
    id: ModelID.OPENAI_GPT_3_5,
    name: 'Default (GPT-3.5)',
  },
  [ModelID.OPENAI_GPT_4]: {
    id: ModelID.OPENAI_GPT_4,
    name: 'GPT-4',
  },
  [ModelID.OLLAMA_LLAMA_3]:{
    id: ModelID.OLLAMA_LLAMA_3,
    name:"LLama 3"
  },
  [ModelID.OLLAMA_PHI_3]:{
    id: ModelID.OLLAMA_PHI_3,
    name:"Phi 3"
  }
};

export interface Message {
  role: Role;
  content: string;
  metadata?: string[];
}

export type Role = 'assistant' | 'user';

export interface ChatFolder {
  id: number;
  name: string;
}

export interface Conversation {
  id: number;
  name: string;
  messages: Message[];
  model: OpenAIModel;
  prompt: string;
  folderId: number;
  index: LlamaIndex;
}

export interface ChatBody {
  messages: Message[];
  prompt: string;
}

export interface KeyValuePair {
  key: string;
  value: any;
}

export interface ErrorMessage {
  code: String | null;
  title: String;
  messageLines: String[];
}

export interface LlamaIndex {
  indexName: string;
  indexType: string;
}

export enum VectorStoreTypes {
  chroma,
  memory,
  supabase
}

export interface KeyConfiguration {
  apiType?: ModelType;
  apiKey?: string;
  azureApiKey?: string;
  ollamaBaseUrl?: string;
  azureInstanceName?: string;
  azureApiVersion?: string;
  azureDeploymentName?: string;
  azureEmbeddingDeploymentName?: string;
}
