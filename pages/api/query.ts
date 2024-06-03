import type { NextApiRequest, NextApiResponse } from 'next';
import { getModel } from '@/utils/openai';

import { ModelType, Message, KeyConfiguration } from '@/types';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from 'langchain/prompts';

import { MODEL_TYPE, SERVICES_DOCUMENTS_FOLDER_PATH } from '@/utils/app/const';
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from '@langchain/core/messages';
import { createConnection } from 'mysql2';
import { Query } from 'mysql2/typings/mysql/lib/protocol/sequences/Query';

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

const cleanSQLQuery = (query: string) => {
  // Remove the triple backticks and new lines
  let cleanedQuery = query.replace(/```/g, '').trim();

  // Find the start of the actual SQL query (from SELECT keyword)
  const selectIndex = cleanedQuery.toUpperCase().indexOf('SELECT');
  if (selectIndex !== -1) {
    cleanedQuery = cleanedQuery.substring(selectIndex);
  }

  // Find the end of the actual SQL query (up to the last semicolon)
  const semicolonIndex = cleanedQuery.lastIndexOf(';');
  if (semicolonIndex !== -1) {
    cleanedQuery = cleanedQuery.substring(0, semicolonIndex + 1);
  }

  return cleanedQuery.trim();
};

// Function to dynamically generate and execute the mysql query
const handleDynamicQuery = async (question: string, llm: any) => {
  // Using the language model to generate the mysql query
  const generatedQuery = await generateSQLQuery(question, llm);

  // Safely execute the generated code
  const results = await executeGeneratedCode(generatedQuery);

  // Combine results into a single text output
  let combinedTextResult = '';
  if (results != undefined) {
    for (const result of results) {
      combinedTextResult += JSON.stringify(result) + '\n';
    }
  }

  return combinedTextResult.trim();
};

// Function to generate my sql query code using the LLM
const generateSQLQuery = async (question: string, llm: any) => {
  const prompt = `
  Generate mysql query based on the following question (RETURN Only the query without any explanation and always return the passenger_trips SUM and add grouped by columns to the selected columns) :
  "{question}"
  The table schema is:
  table name: metro_tram_ridership 
  columns:
    year int(4) ,
    month varchar(10),
    transport_mode varchar(50), (e.g., 'Metro', 'Tram')
    station_line varchar(50), (e.g., 'Green Metro Line', 'Red Metro Line', which is a line in the metro network or "Tram Line" for Tram) )
    station_name varchar(100),
    passenger_trips int(11), (Total number of passenger trips per station per month, year and transport mode)

    YOU CAN GENERATE MULTIPLE QUERIES, INCLUDE ALL COLUMNS REQUESTED IN THE QUESTION
    Don't Count only SUM as the passenger_trips is already a total , each row is the total pasenger trips for one station
`;

  // Prompt Template
  const promptTemplate = PromptTemplate.fromTemplate(prompt);

  // @ts-ignore
  const chain = promptTemplate.pipe(llm);

  const response = (await chain.invoke({
    question: question,
  })) as AIMessageChunk;

  const messageResponse = response.content
    ? response.content.toString()
    : response.toString();

  console.log('---------- Generated Query ---------\n', messageResponse);
  return messageResponse;
};

// Function to execute the generated mysql query with local db connection
const executeGeneratedCode = async (query: string) => {
  try {

    // Split the cleaned query into multiple queries using semicolon
    const queries = query.split(';').filter((q) => q.trim() !== '');

    // Create connection to MySQL database
    const connection = createConnection({
      host: 'localhost',
      port: 3309,
      user: 'root',
      password: 'pen@123',
      database: 'gai_ridership',
      insecureAuth: true,
    });

    // Connect to MySQL database
    connection.connect();

    let combinedResults: any[] = [];

    for (const query of queries) {
      // Clean query string to prevent SQL injection
      const cleanedQuery = cleanSQLQuery(query);
      console.log('Executing cleaned query: ', cleanedQuery);
      const result = await new Promise((resolve, reject) => {
        connection.query(cleanedQuery, (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
          }
        });
      });
      combinedResults.push(result);
    }

    // Close connection
    connection.end();

    console.log(
      '---------- Combined Query Results ---------\n',
      combinedResults,
    );

    return combinedResults;
  } catch (error) {
    console.error('Error:', error);
  }
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

    // Convert Messages to BaseMessage
    var chatHistory = messages.map((message) => {
      if (message.role === 'user') {
        return new HumanMessage(message.content.toString());
      } else {
        return new AIMessage(message.content.toString());
      }
    });

    // Check if the input is empty and return an error
    if (!input) {
      res
        .status(400)
        .json({ responseMessage: 'Input is empty or not well formatted' });
      return;
    }

    var result = await handleDynamicQuery(input, llm);

    const generateSummary = async (question: string, data: string) => {
      const systemPrompt = `Answer the question based on the context given below. Only Show the answer don't add more to it`;

      const promptTemplate = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        new MessagesPlaceholder('chat_history'),
        ['human', 'Data: {data} Question Asked: {question}'],
      ]);

      // Prompt Template
      //@ts-ignore
      const contextChain = promptTemplate.pipe(llm);

      const response = await contextChain.invoke({
        question: question,
        data: JSON.stringify(data),
        chat_history: chatHistory,
      });

      const messageResponse = response.content
        ? response.content.toString()
        : response.toString();

      console.log(messageResponse);

      return messageResponse;
    };

    if (result === undefined) {
      res
        .status(200)
        .json({ responseMessage: 'No Data Available for your query' });
      return;
    }

    // if the result is JSON Convert it to string
    if (typeof result === 'object') {
      result = JSON.stringify(result);
    }

    var summary = await generateSummary(input, result as string);

    res.status(200).json({ responseMessage: summary });
  } catch (e) {
    console.log('error in handler: ', e);
    res.status(500).json({ responseMessage: (e as Error).toString() });
  }
};

export default handler;
