import {ChatBody} from '@/types';
import {getKeyConfiguration} from "@/utils/app/configuration";
import {NextApiRequest, NextApiResponse} from "next";
import {DEFAULT_SYSTEM_PROMPT} from "@/utils/app/const";
import {AIChatMessage, BaseChatMessage, HumanChatMessage} from "langchain/schema";
import {getChatModel} from "@/utils/openai";
import {ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate} from "langchain/prompts";
import {BufferMemory, ChatMessageHistory} from "langchain/memory";
import {ConversationChain, LLMChain, RetrievalQAChain, StuffDocumentsChain} from "langchain/chains";


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const keyConfiguration = getKeyConfiguration(req);

  //const message: string = req.query.message as string;
  const { messages, prompt } = req.body as ChatBody;

  try {
    const llm = await getChatModel(keyConfiguration, res);

    const historyMessages: BaseChatMessage[] = messages?.slice(0, messages.length - 1)
  .map((message) => {
    if (message.role === 'user') {
      return new HumanChatMessage(message.content);
    } else if (message.role === 'assistant') {
      return new AIChatMessage(message.content);
    }
    throw new TypeError('Invalid message role');
  });

  let input: string;
  if (messages.length === 1) {
    input = messages[0].content;
  } else {
    input = messages[messages.length - 1].content;
  }
    
    const memory = new BufferMemory({
      chatHistory: new ChatMessageHistory(historyMessages),
    });

    var promptText =
    "respond only from context, and make sure that you respond in one sentence, if i said 'how are you' or any greeting you should respond with a greeting like 'i am fine' or 'i am fine, how are you'.";

    // Set prompt template
    console.info('Setting prompt template...');
    const promptTemplate = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
    promptText ? promptText : DEFAULT_SYSTEM_PROMPT,
    ),
    HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    const chain = new RetrievalQAChain({llm});

    chain.call({ 
      input
    }).catch(console.error);
  } catch (err) {
    console.error(err);
    let error = "Unexpected message";
    if (err instanceof Error) {
      error = err.message;
    }
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};


export default handler;
