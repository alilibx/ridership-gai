import { getExistingVectorStore } from '@/utils/vector';
import { BufferMemory, ChatMessageHistory } from 'langchain/memory';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { NextApiRequest, NextApiResponse } from 'next';
import { getKeyConfiguration } from '@/utils/app/configuration';
import { getModel } from '@/utils/openai';
import {
  AIChatMessage,
  BaseChatMessage,
  HumanChatMessage,
} from 'langchain/schema';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts';
import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Load Configuration from The Request
    console.info('Loading configuration from request...');
    const keyConfiguration = getKeyConfiguration(req);

    // Get the body from the request
    console.info('Retrieving body from request...');
    const messages = JSON.parse(req.body).messages;

    // Get Message input from message history
    console.info('Retrieving message input from message history...');
    let input: string;
    if (messages.length === 1) {
      input = messages[0].content;
    } else {
      input = messages[messages.length - 1].content;
    }

    // Get Existing Vector Store
    console.info('Retrieving existing vector store...');
    const vectorStore = await getExistingVectorStore(keyConfiguration);

    // Load the LLM Model
    console.info('Loading LLM model...');
    const llm = await getModel(keyConfiguration, res);

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

    // Set Conversation Retrieval chain to ingest documents and question
    var promptText =
      "respond only from context, and make sure that you respond in one sentence, if i said 'how are you' or any greeting you should respond with a greeting like 'i am fine' or 'i am fine, how are you', if the question is not in the context say 'i don't have any information about that'";

    console.info('Set Stuff chain to ingest documents and question...');
    const chain = ConversationalRetrievalQAChain.fromLLM(
      llm,
      vectorStore.asRetriever(),
      {
        memory: new BufferMemory({
          memoryKey : "chat_history"
        }),
      }
    );

   

    chain.call({ question: input + ' ' + suffixPrompt }).catch(console.error);
  } catch (err) {
    console.error(err);
    let error = '';
    if (err instanceof Error) {
      error = err.message;
    }
    res.status(500).json({ error });
  }
};

export default handler;
