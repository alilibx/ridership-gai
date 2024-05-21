import type { NextApiRequest, NextApiResponse } from 'next';
import { getModel } from '@/utils/openai';

import { ModelType, Message, KeyConfiguration } from '@/types';
import { PromptTemplate } from 'langchain/prompts';

import { z} from 'zod';

const keyConfiguration: KeyConfiguration = {
  apiType: ModelType.AZURE_OPENAI,
  azureApiKey: process.env.AZURE_OPENAI_API_KEY!,
  azureDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME!,
  azureEmbeddingDeploymentName:
    process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME!,
  azureInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
  azureApiVersion: process.env.AZURE_OPENAI_API_VERSION!
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    console.info('Starting query handler...');
    // Load the LLM Model
    console.info('Loading LLM model...');
    const llm = await getModel(keyConfiguration, res);

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

    // Set Prompt 

    const DEFAULT_QA_PROMPT = new PromptTemplate({
      template:
        "Use the following pieces of context to answer the question at the end. If you don't know the answer, ask a followup question coming from the question regardless of the output language, don't try to make up an answer.\n\n{context}\n\nQuestion: {question}\nHelpful Answer:",
      inputVariables: ["context", "question"],
    });

    const metroDataSchema = z.object({
      'Month of Year': z
        .string()
        .describe("The month and year for the recorded data."),
      'Station Line': z
        .string()
        .describe("The metro line to which the station belongs."),
      'Station Name': z
        .string()
        .describe("The name of the metro station."),
      'Metro Passenger Trips': z
        .number()
        .describe("The number of passenger trips recorded for the metro."),
      'Tram Passenger Trips': z
        .number()
        .describe("The number of passenger trips recorded for the tram."),
      'Total': z
        .number()
        .describe("The total number of passenger trips (metro + tram)."),
    });

    // Get the response from the LLM model
    const response = await llm.invoke(input);


    res.status(200).json({ responseMessage: response.content });


  } catch (e) {
    console.log('error in handler: ', e);
    res.status(500).json({ responseMessage: (e as Error).toString() });
  }
};

export default handler;
