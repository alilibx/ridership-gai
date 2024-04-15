import { MemoryVectorStore } from 'langchain/vectorstores/memory';

declare global {
  var vectorStore: MemoryVectorStore | null;
}

globalThis.vectorStore = null;

export const setGlobalVectorStore = (vectorStore: MemoryVectorStore) => {
  globalThis.vectorStore = vectorStore;
};

export const getGlobalVectorStore = () => {
  return globalThis.vectorStore;
};