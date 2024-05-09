import { KeyConfiguration, ModelType, OpenAIModels } from "@/types";
import { ChatOpenAI, AzureChatOpenAI } from "@langchain/openai";
import {CallbackManager} from "langchain/callbacks";
import {NextApiResponse} from "next";

export const getModel = async (keyConfiguration: KeyConfiguration, res: NextApiResponse) => {
    if (keyConfiguration.apiType === ModelType.AZURE_OPENAI) {
        return new AzureChatOpenAI({
            modelName: OpenAIModels["gpt-3.5-turbo"].id,
            temperature: 0.9,
            streaming: false,
            openAIApiKey: keyConfiguration.azureApiKey,
            openAIBasePath: "https://" + keyConfiguration.azureInstanceName + ".openai.azure.com",
            azureOpenAIApiDeploymentName: keyConfiguration.azureDeploymentName,
            azureOpenAIApiInstanceName: keyConfiguration.azureInstanceName,                    
            azureOpenAIApiVersion: keyConfiguration.azureApiVersion,
            //callbacks: getCallbackManager(res),
        });
    } else {
        return new ChatOpenAI({
            modelName: OpenAIModels["gpt-3.5-turbo-16k"].id,
            temperature: 0.9,
            streaming: true,
            openAIApiKey: keyConfiguration.apiKey,
            //callbacks: getCallbackManager(res),
        });
    }
}

export const getChatModel = async (keyConfiguration: KeyConfiguration, res: NextApiResponse) => {
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
}