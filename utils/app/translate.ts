import {
    ChatPromptTemplate,
  } from '@langchain/core/prompts';

import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';

export function isArabic(text: string) {
    // Check for presence of Arabic characters (Unicode range)
    const arabicRegex = /[\u0600-\u06FF]/g;
    return arabicRegex.test(text);
}
  
export const translateTextToArabic = async (text: string, model : ChatOpenAI| AzureChatOpenAI) => {
    const chatPrompt = ChatPromptTemplate.fromMessages([
    ["human", "Translate text from English to Arabic. Text: {text}. output only the translation without any other text. output only the translated text "],
    ]);
  
    const chain = chatPrompt.pipe(model);
    const response = await chain.invoke({
      text: text,
    });
  
    return response;
}