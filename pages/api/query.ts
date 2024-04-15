import type { NextApiRequest, NextApiResponse } from 'next';
import { getExistingVectorStore } from '@/utils/vector';
import { getModel } from '@/utils/openai';
import { loadQAStuffChain } from 'langchain/chains';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import {
  DEFAULT_SYSTEM_PROMPT,
  ISMEMORY_VECTOR_STORE,
} from '@/utils/app/const';
import { ChatBody, ModelType, Message, KeyConfiguration, VectorStoreTypes } from '@/types';
import { OpenAIChat } from "langchain/llms/openai";
import { PromptTemplate } from 'langchain/prompts';
import { getGlobalVectorStore, setGlobalVectorStore } from '@/utils/globalVectorStore';

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

    // Check the language of the input
    console.info('Check the language of the input...');
    const language = isArabic(input)? 'ar' : 'en';

    // Get Existing Vector Store
    console.info('Retrieving existing vector store...');
    // Get the global vector store
    let vectorStore = getGlobalVectorStore();
    
    if (!vectorStore) {
      // If the global vector store is not initialized, create it and set it globally
      vectorStore = await getExistingVectorStore(keyConfiguration);
      setGlobalVectorStore(vectorStore);
    }

    // Retrieving documents from vector store by using similarity search
    console.info(
      'Retrieving documents from vector store by using similarity search...',
    );
    const documentsWithScore = await vectorStore!.similaritySearchWithScore(
      input,
      10,
    );

    // extract only the documents from the documents array or arrays of [Document, integer]
    console.info('Extracting only the documents from the documents array...');
    const documents = documentsWithScore.map((doc) => doc[0]);

    // Log Documents to the console
    console.info('Logging documents to the console...');
    console.log(documents);

    // Set Prompt 

    const DEFAULT_QA_PROMPT = new PromptTemplate({
      template:
        "Use the following pieces of context to answer the question at the end. If you don't know the answer, ask a followup question coming from the question regardless of the output language, don't try to make up an answer.\n\n{context}\n\nQuestion: {question}\nHelpful Answer:",
      inputVariables: ["context", "question"],
    });
    

    // Set Stuff chain to ingest documents and question
    console.info('Set Stuff chain to ingest documents and question...');
    const stuffChain = loadQAStuffChain(llm, {
      prompt: DEFAULT_QA_PROMPT,
    });

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
          score: Math.round((1 - doc[1]) * 300),
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
    

    // Filter input string to remove stop words and any special characters and convert it to upper case
    var clearText = input
      .replace(/[^\w\s]|_/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase();

    // remove URLs from the output text
    outputText = outputText.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');

    var outputLanguage = isArabic(outputText)? 'ar' : 'en';

    // If the output is english and input language is arabic translate the output to arabic
    if (outputLanguage === 'en' && language === 'ar') {
      outputText = await translateTextToArabic(outputText, llm);
    }

    if(outputText.includes('NOTAVAILABLE') || outputText.includes('متوفر') || outputText.includes('متاح')){ 
      if(language === 'ar') {
        outputText = "الرجاء مراجعة الخدمات التالية ، اذا لم تتمكن من العثور على الخدمة التي تبحث عنها، اسال سؤالك بطريقة اخرى.";
      }else{
        outputText = "Please look at below services, and if you can't find what you are looking for, rephrase your question.";
      }
    }

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


function isArabic(text: string) {
  // Check for presence of Arabic characters (Unicode range)
  const arabicRegex = /[\u0600-\u06FF]/g;
  return arabicRegex.test(text);
}

const translateTextToArabic = async (text: string, model : OpenAIChat) => {
  const chatPrompt = ChatPromptTemplate.fromMessages([
  ["human", "Translate text from English to Arabic. Text: {text}. output only the translation without any other text. output only the translated text "],
  ]);

  const chain = chatPrompt.pipe(model);
  const response = await chain.invoke({
    text: text,
  });

  return response;
}

export default handler;
