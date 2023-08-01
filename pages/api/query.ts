import type { NextApiRequest, NextApiResponse } from 'next';
import { getExistingVectorStore } from '@/utils/vector';
import { getModel } from '@/utils/openai';
import { StuffDocumentsChain, loadQAChain, loadQAMapReduceChain, loadQARefineChain, loadQAStuffChain } from 'langchain/chains';
import {
  AIChatMessage,
  BaseChatMessage,
  HumanChatMessage,
} from 'langchain/schema';
import { getKeyConfiguration } from '@/utils/app/configuration';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts';
import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';
import { ChatBody, ModelType, Message } from '@/types';

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    console.info('Starting query handler...');
    // Load Configuration from The Request
    console.info('Loading configuration from request...');
    const keyConfiguration = getKeyConfiguration(req);

    keyConfiguration.apiKey = process.env.OPENAI_API_KEY;
    keyConfiguration.apiType = ModelType.OPENAI;

    // Load the LLM Model
    console.info('Loading LLM model...');
    const llm = await getModel(keyConfiguration, res);

    // Get the body from the request
    console.info('Retrieving body from request...');
    let input: string;
    let messages: Message[] = [];
    // Check if the request method is POST get the messages from the body otherwise get only one input from input query string       
    if (req.method === 'POST') {
      messages = (req.body as ChatBody).messages;
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
      res.status(400).json({ responseMessage: 'Input is empty or not well formatted' });
      return;
    }

    // Base Prompt Text
    console.info('Setting base prompt text...');
    var promptText =
    "Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't have any information about that, don't try to make up an answer. make sure the answer is short and to the point, if the question is a greeting. reply with a greeting, also answer only with the same language as the question. \n" +
    '\n' +
    '{context}\n' +
    '\n' +
    'Question: {question}\n' +
    'Helpful Answer:';

    // Get and Format Message History
    console.info('Retrieving and formatting message history...');
    const historyMessages: BaseChatMessage[] = messages
      ?.slice(0, messages.length - 1)
      .map((message: { role: string; content: string }) => {
        if (message.role === 'user') {
          return new HumanChatMessage(message.content);
        } else if (message.role === 'assistant') {
          return new AIChatMessage(message.content);
        }
        throw new TypeError('Invalid message role');
      });

    // Set prompt template
    console.info('Setting prompt template...');
    const promptTemplate = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
      promptText ? promptText : DEFAULT_SYSTEM_PROMPT,
      ),
      // new MessagesPlaceholder("history"),
      //HumanMessagePromptTemplate.fromTemplate(promptText),
    ]);

    // Get Existing Vector Store
    console.info('Retrieving existing vector store...');
    const vectorStore = await getExistingVectorStore(keyConfiguration);

    // Retrieving documents from vector store by using similarity search
    console.info(
      'Retrieving documents from vector store by using similarity search...',
    );
    const documentsWithScore = await vectorStore.similaritySearchWithScore(input, 6);

    // extract only the documents from the documents array or arrays of [Document, integer]
    console.info('Extracting only the documents from the documents array...');
    const documents = documentsWithScore.map((doc) => doc[0]);

    // // Check if metadata is available and log it
    // console.info('Checking if metadata is available and logging it...');

    // Set Stuff chain to ingest documents and question
    console.info('Set Stuff chain to ingest documents and question...');
    const stuffChain = loadQAStuffChain(llm, {prompt : promptTemplate});

   var response = await stuffChain
      .call({
        input_documents: documents,
        question: input,
      })
      .catch(console.error);

      // return an array of service ids numbers only from the documents but only when the service id is not null 
      // Also get the similary score integer from the documents array [Document, integer]
      const data = documentsWithScore
      .map((doc) => {
        return {
          unique_id: doc[0].metadata.unique_id,
          title: doc[0].metadata.name,
          level: 0,
          // round the score to 2 decimal places
          score: 80,
        };
      })
      .filter((doc) => doc.unique_id != null);
      
      var outputText = '';
      // Make sure the response is not empty and return the text inside the response
      if (response == null) {
        outputText = "Sorry, I don't have an answer for that.";
      }else {
        outputText = response.text;
      }
      // If response containes [{"type" then parse it as array and get the first item as json and get the data.content from it
      // else if response contains {"text" then parse it as json and get the data.content from it
      // else if outputText contains {"answer" then parse it as json and get the value of answer from it

      if (outputText.includes('[{"type"')) {
        var responseJson = JSON.parse(outputText);
        outputText = responseJson[0].data.content;
      }else if (outputText.includes('{"type"')) {
        var responseJson = JSON.parse(outputText);
        outputText = responseJson.data.content;
      }else if (outputText.includes('{"answer"')) {
        var responseJson = JSON.parse(outputText);
        outputText = responseJson.answer;
      } else if (outputText.includes('{"message"')) {
        var responseJson = JSON.parse(outputText);
        outputText = responseJson.data.content;
      }

      // Filter input string to remove stop words and any special characters and convert it to upper case 
      var clearText = input.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").toUpperCase();

      res.status(200).json({ response_text: outputText, data, total: data.length,  text_clean: clearText});

    console.log('handler chatfile query done: ', input, documents.length);
  } catch (e) {
    console.log('error in handler: ', e);
    res.status(500).json({ responseMessage: (e as Error).toString() });
  }
};

export default handler;
