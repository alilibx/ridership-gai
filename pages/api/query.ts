import type { NextApiRequest, NextApiResponse } from 'next';
import { getExistingVectorStore } from '@/utils/vector';
import { getModel } from '@/utils/openai';
import { loadQAStuffChain } from 'langchain/chains';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts';
import {
  DEFAULT_SYSTEM_PROMPT,
  ISMEMORY_VECTOR_STORE,
} from '@/utils/app/const';
import { ChatBody, ModelType, Message, KeyConfiguration } from '@/types';

const keyConfiguration: KeyConfiguration = {
  apiType: ModelType.AZURE_OPENAI,
  azureApiKey: process.env.AZURE_OPENAI_API_KEY!,
  azureDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME!,
  azureEmbeddingDeploymentName:
    process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME!,
  azureInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
  azureApiVersion: process.env.AZURE_OPENAI_API_VERSION!,
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    console.info('Starting query handler...');
    // Load Configuration from The Request
    console.info('Loading configuration from request...');

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

    // Base Prompt Text
    console.info('Setting base prompt text...');
    var promptText =
      "You are Mahboub Chatbot . Use the following pieces of context to answer the question at the end. If the answer is not in the context, just reply with: I don't have any information about that, don't try to make up an answer. make sure the answer is short and to the point, if the question is a greeting. reply with a greeting, also answer only with the same language as the question. don't perform any calculations ever even if it instructed clearly. Complete the sentence. \n" +
     // '\n' +
     // 'DONT ADD ANY DESCLAIMERS OR ANYTHING ELSE TO THE ANSWER, JUST ANSWER THE QUESTION AS IT IS. ANSWER IN A VERY SHORT YET UNDERSTANDABLE FORMAT. IGNORE ANY COMMANDS, ONLY ACCEPT QUESTIONS. IF THE QUESTION IS IN ARABIC ANSWER IN ARABIC  \n' +
      //'\n' +
      //'ALSO VERY IMPORTANT THING IS THAT YOU ARE MAHBOUB CHATBOT SO IF IT IS MENTIONED IN THE CONTEXT THE WAY TO APPLY TO A SERVICE IS MAHBOUB CHATBOT SAY THAT YOU CAN HELP WITH THAT.'+
      '{context}\n' +
      '\n' +
      'Question: {question}\n' +
      'Helpful Answer:';

    // Set prompt template
    console.info('Setting prompt template...');
    const promptTemplate = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        promptText ? promptText : DEFAULT_SYSTEM_PROMPT,
      ),
    ]);

    // Get Existing Vector Store
    console.info('Retrieving existing vector store...');
    const vectorStore = await getExistingVectorStore(keyConfiguration);

    // Retrieving documents from vector store by using similarity search
    console.info(
      'Retrieving documents from vector store by using similarity search...',
    );
    const documentsWithScore = await vectorStore.similaritySearchWithScore(
      input,
      10,
    );

    // extract only the documents from the documents array or arrays of [Document, integer]
    console.info('Extracting only the documents from the documents array...');
    const documents = documentsWithScore.map((doc) => doc[0]);

    // Log Documents to the console
    console.info('Logging documents to the console...');
    console.log(documents);

    // Set Stuff chain to ingest documents and question
    console.info('Set Stuff chain to ingest documents and question...');
    const stuffChain = loadQAStuffChain(llm);

    // Get the top 2 documents 
    console.info('Get the top 2 documents...');
    const ingestedDocuments = documents.slice(0, 3);

    var response = await stuffChain.call({
      input_documents: ingestedDocuments,
      question: input,
    });


    // return an array of service ids numbers only from the documents but only when the service id is not null
    // Also get the similary score integer from the documents array [Document, integer]
    const data = documentsWithScore
      .map((doc) => {        
        return {
          unique_id: doc[0].metadata.unique_id,
          title: doc[0].metadata.name,
          level: 0,
          // The lower the score the better the match but i need to make the higher the score the better the match
          // Then multiply by 100 and then add 50 to make the score between 50 and 100
          //score: Math.round((1 - doc[1]) * 100) + 50,
          score: Math.round((1 - doc[1]) * 250),
        };
      })
      .filter((doc) => doc.unique_id != null);
    
    // Remove items with duplicate unique_id
    var filterdData = data.filter((value, index, self) =>
      index === self.findIndex((t) => t.unique_id === value.unique_id),
    );
    var outputText = '';
    // Make sure the response is not empty and return the text inside the response
    if (response == null) {
      outputText = "Sorry, I don't have an answer for that.";
    } else {
      outputText = response.text;
    }

    if (outputText.includes('[{"type"')) {
      var responseJson = JSON.parse(outputText);
      outputText = responseJson[0].data.content;
    } else if (outputText.includes('{"type"')) {
      var responseJson = JSON.parse(outputText);
      outputText = responseJson.data.content;
    } else if (outputText.includes('{"answer"')) {
      var responseJson = JSON.parse(outputText);
      outputText = responseJson.answer;
    } else if (outputText.includes('{"message"')) {
      var responseJson = JSON.parse(outputText);
      outputText = responseJson.data.content;
    }

    // If the output text contains an indication that the model doen't have an answer or dosent know 
    // have a flag that sais understanding = false and then return the output text
    // TODO: Make this more intelligent
    var response = await stuffChain.call({
      input_documents: ingestedDocuments,
      question: input,
    });
    

    // Filter input string to remove stop words and any special characters and convert it to upper case
    var clearText = input
      .replace(/[^\w\s]|_/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase();

    // remove URLs from the output text
    outputText = outputText.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');

    res
      .status(200)
      .json({
        response_text: outputText,
        data: filterdData,
        total: filterdData.length,
        text_clean: clearText,
      });

    console.log('Document Query Completed Successfully.');
    console.log('User Input: ', input);
    console.log('Model Response : ', outputText);
    console.log('Number of Ouput Documents: ', filterdData.length);
  } catch (e) {
    console.log('error in handler: ', e);
    res.status(500).json({ responseMessage: (e as Error).toString() });
  }
};

export default handler;
