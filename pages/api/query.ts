import type { NextApiRequest, NextApiResponse } from 'next';
import { getModel } from '@/utils/openai';

import { ModelType, Message, KeyConfiguration } from '@/types';
import path from 'path';
import fs from 'fs';
import { SERVICES_DOCUMENTS_FOLDER_PATH } from '@/utils/app/const';
import { PromptTemplate } from 'langchain/prompts';
import { AzureChatOpenAI } from '@langchain/openai';
import { Ollama } from '@langchain/community/llms/ollama';

const keyConfiguration: KeyConfiguration = {
  apiType: ModelType.AZURE_OPENAI,
  azureApiKey: process.env.AZURE_OPENAI_API_KEY!,
  azureDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME!,
  azureEmbeddingDeploymentName:
    process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME!,
  azureInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
  azureApiVersion: process.env.AZURE_OPENAI_API_VERSION!,
};

const loadData = async (keyConfiguration: KeyConfiguration) => {
  const folderPath =
    SERVICES_DOCUMENTS_FOLDER_PATH ||
    '/Volumes/Stuff/Development/office/rta/docs/Projects/Ridership/';

  const dataFilePath = path.join(folderPath, 'MetroTramRidership234.json');
  const jsonData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));

  return jsonData;
};

const generateLogic = async (
  query: string,
): Promise<string> => {
  const promptTemplate = PromptTemplate.fromTemplate(
    `Given the user's query: "${query}", generate the necessary JavaScript code to filter and aggregate the data accordingly. The data is an array of objects with the following keys: "Month of Year", "Transport Mode", "Station Line", "Station Name", "Passenger Trips". Only generate the logic, do not include any dummy data. Ensure the code returns the appropriate result based on the query.`,
  );
  const llm = await getModel(keyConfiguration);

  // @ts-ignore
  const chain = promptTemplate.pipe(llm);

  const result = await chain.invoke({ query: query });

  return result.content.toString();
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    console.info('Starting query handler...');
    // Load the LLM Model
    console.info('Loading LLM model...');
    const llm = await getModel(keyConfiguration);

    // Get the body from the request
    console.info('Retrieving body from request...');
    let input: string;
    let messages: Message[] = [];
    // Check if the request method is POST get the messages from the body otherwise get only one input from input query string
    if (req.method === 'POST') {
      // Check if req.body is already parsed then get the messages from it otherwise parse it as JSON and get the messages from it
      if (req.body?.messages) {
        messages = req.body.messages;
      } else {
        messages = JSON.parse(req.body).messages;
      }

      // Get Message input from message history
      console.info('Retrieving message input from message history...');
      if (messages.length === 1) {
        input = messages[0].content;
      } else {
        input = messages[messages.length - 1].content;
      }
    } else {
      input = req.query.input as string;
    }

    // Check if the input is empty and return an error
    if (!input) {
      res
        .status(400)
        .json({ responseMessage: 'Input is empty or not well formatted' });
      return;
    }

    const data = await loadData(keyConfiguration);
    const logic = await generateLogic(input);
    console.log('logic: ', logic);

    // Use Function constructor to create a new function from the generated code
    const filterAndAggregate = new Function('data', logic);
    const result = filterAndAggregate(data);
    console.log('result: ', result);
    
    res.status(200).json({ responseMessage: 'OK' });
  } catch (e) {
    console.log('error in handler: ', e);
    res.status(500).json({ responseMessage: (e as Error).toString() });
  }
};

export default handler;
