import { KeyConfiguration, ModelType, AIModels } from '@/types';
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { Ollama } from '@langchain/community/llms/ollama';
import { CallbackManager } from 'langchain/callbacks';
import { NextApiResponse } from 'next';
import { Console } from 'console';

export const getModel = async (
  keyConfiguration: KeyConfiguration
) => {
  console.log('Model Type', keyConfiguration.apiType);
  if (keyConfiguration.apiType === ModelType.AZURE_OPENAI) {
    return new AzureChatOpenAI({
      modelName: AIModels['gpt-3.5-turbo'].id,
      temperature: 0,
      streaming: false,
      openAIApiKey: keyConfiguration.azureApiKey,
      openAIBasePath:
        'https://' + keyConfiguration.azureInstanceName + '.openai.azure.com',
      azureOpenAIApiDeploymentName: keyConfiguration.azureDeploymentName,
      azureOpenAIApiInstanceName: keyConfiguration.azureInstanceName,
      azureOpenAIApiVersion: keyConfiguration.azureApiVersion
      
      //callbacks: getCallbackManager(res),
    });
  } else {
    return new Ollama({
      baseUrl: keyConfiguration.ollamaBaseUrl,
      model: AIModels['llama3'].id
    });
  }
};

export const getChatModel = async (
  keyConfiguration: KeyConfiguration,
  res: NextApiResponse,
) => {
  if (keyConfiguration.apiType === ModelType.AZURE_OPENAI) {
    return new AzureChatOpenAI({
      temperature: 0.9,
      streaming: true,
      azureOpenAIApiKey: keyConfiguration.azureApiKey,
      azureOpenAIApiInstanceName: keyConfiguration.azureInstanceName,
      azureOpenAIApiDeploymentName: keyConfiguration.azureDeploymentName,
      azureOpenAIApiVersion: keyConfiguration.azureApiVersion,
    });
  } else {
    return new ChatOpenAI({
      temperature: 0.9,
      streaming: true,
      openAIApiKey: keyConfiguration.apiKey,
    });
  }
};
