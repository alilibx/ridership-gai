import type { NextApiRequest, NextApiResponse } from 'next';
import { getModel } from '@/utils/openai';

import { ModelType, Message, KeyConfiguration } from '@/types';
import { PromptTemplate } from 'langchain/prompts';
import { z } from 'zod';
import fs from 'fs';
import { MODEL_TYPE, SERVICES_DOCUMENTS_FOLDER_PATH } from '@/utils/app/const';
import path from 'path';


const folderPath =
  SERVICES_DOCUMENTS_FOLDER_PATH ||
  '/Volumes/Stuff/Development/office/rta/docs/Projects/Ridership/';

const keyConfiguration: KeyConfiguration = {
  apiType: MODEL_TYPE ?? ModelType.AZURE_OPENAI,
  azureApiKey: process.env.AZURE_OPENAI_API_KEY!,
  azureDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME!,
  azureEmbeddingDeploymentName:
    process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME!,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  azureInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
  azureApiVersion: process.env.AZURE_OPENAI_API_VERSION!,
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

    // Load the CSV data
    const dataFilePath = path.join(folderPath, 'MetroTramRidership234.json');
    const sampleData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));

    // Function to dynamically generate and execute the filtration code
    const handleDynamicQuery = async (question: string) => {
      // Using the language model to generate the filtration code
      const generatedCode = await generateFiltrationCode(question);

      // Safely execute the generated code
      const result = executeGeneratedCode(generatedCode);
      return result;
    };

    // Function to generate filtration code using the LLM
    const generateFiltrationCode = async (question: string) => {
      const prompt = `
      Generate JavaScript code ONLY to filter based on the following question (Make sure to return full row data in the JSON format) with no explanation or comments:
      "{question}"
  The data schema is:
      month: string,
      transport_mode: string, (e.g., 'Metro', 'Tram')
      station_line: string, (e.g., 'Green Metro Line', 'Red Metro Line', which is a line in the metro network)
      station_name: string, 
      passenger_trips: number, (ignore 0 and negative values)
  Data is stored in the sampleData variable.
  Ensure the code is in one line.
  `;

      // Prompt Template
      const promptTemplate = PromptTemplate.fromTemplate(prompt);

      // @ts-ignore
      const chain = promptTemplate.pipe(llm); 

      const response = await chain.invoke({ question: question });

      const messageResponse = response.content
        ? response.content.toString()
        : response.toString();

      console.log(messageResponse);
      return messageResponse;
    };

    // Function to execute the generated code
    const executeGeneratedCode = (code: string) => {
      try {
        var dynamicFunction = `${code}`;

        const indexOfConst = dynamicFunction.indexOf('const');
        const indexOfVar = dynamicFunction.indexOf('var');
        const indexOfFilteredVariable = dynamicFunction.indexOf('filteredData');
        const indexOfResult = dynamicFunction.indexOf('result');
        if (indexOfConst > 0 || indexOfVar > 0 || indexOfFilteredVariable > 0 || indexOfResult > 0) {
          // Remove all text before the first equal sign
          const indexOfEqualSign = dynamicFunction.indexOf('=');
          dynamicFunction = dynamicFunction.substring(indexOfEqualSign + 1);
        }

        // Create a new function from the dynamicFunction string
        const filteredDataResult = eval(dynamicFunction);

        return filteredDataResult;
      } catch (error) {
        return undefined;
      }
    };

    var result = await handleDynamicQuery(input);
    

    const generateSummary = async (question: string, data: string) => {
      const prompt = `
    Generate a summary of the data based on the following question:
    "{question}"
    The data is:
    "{data}"
    The summary should be short and to the point, if the data doen't exists then return "No Data Available for your query".
  `;

      // Prompt Template
      const promptTemplate = PromptTemplate.fromTemplate(prompt);

      // LLM Chain
      // @ts-ignore
      const chain = promptTemplate.pipe(llm);

      const response = await chain.invoke({
        question: question,
        data: JSON.stringify(data),
      });

      const messageResponse = response.content
        ? response.content.toString()
        : response.toString();

      console.log(messageResponse);

      return messageResponse;
    };

    if(result === undefined){
      res.status(200).json({ responseMessage: 'No Data Available for your query' });
      return;
    }

    var summary = await generateSummary(input, result);

    res.status(200).json({ responseMessage: summary });
  } catch (e) {
    console.log('error in handler: ', e);
    res.status(500).json({ responseMessage: (e as Error).toString() });
  }
};

export default handler;
