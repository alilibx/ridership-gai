import {SupabaseFilterRPCCall, SupabaseVectorStore} from "langchain/vectorstores/supabase";
import  { MemoryVectorStore} from 'langchain/vectorstores/memory'
import {createClient} from "@supabase/supabase-js";
import {Document} from "langchain/dist/document";
import {OPENAI_TYPE, SUPABASE_KEY, SUPABASE_URL} from "@/utils/app/const";
import {getEmbeddings} from "@/utils/embeddings";
import { KeyConfiguration, ModelType } from "@/types";


const client = createClient(SUPABASE_URL!, SUPABASE_KEY!);

export const getVectorStore = async (keyConfiguration: KeyConfiguration, texts: string[], metadata: object, isMemory : boolean) => {
    if (isMemory) {
        // Return a memory vector store
        return await MemoryVectorStore.fromTexts(texts, metadata, await getEmbeddings(keyConfiguration));
    }else{
        return await SupabaseVectorStore.fromTexts(texts, metadata, await getEmbeddings(keyConfiguration),
            {
                client,
                tableName: "documents",
                queryName: "match_documents",
            }
        );
    }
}

export const getExistingVectorStore = async (keyConfiguration: KeyConfiguration, isMemory : boolean) => {
    if (isMemory) {
        // Return a memory vector store
        return await MemoryVectorStore.fromExistingIndex(await getEmbeddings(keyConfiguration));
    }else{
        return await SupabaseVectorStore.fromExistingIndex(await getEmbeddings(keyConfiguration),
            {
                client,
                tableName: "documents",
                queryName: "match_documents",
            }
        );
    }
}

export const saveEmbeddings = async (keyConfiguration: KeyConfiguration, documents: Document[], isMemory: boolean) => {
    if (isMemory) {
        // Return a memory vector store
        const memoryVectorStore = await MemoryVectorStore.fromExistingIndex(await getEmbeddings(keyConfiguration));
        await memoryVectorStore.addDocuments(documents);
    }else{
        const supabaseVectorStore = new SupabaseVectorStore(await getEmbeddings(keyConfiguration),
            {client, tableName: "documents", queryName: "match_documents"});

        // wait for https://github.com/hwchase17/langchainjs/pull/1598 to be released
        if (keyConfiguration.apiType === ModelType.AZURE_OPENAI) {
            for (const doc of documents) {
                await supabaseVectorStore.addDocuments([doc]);
            }
        } else {
            await supabaseVectorStore.addDocuments(documents);
        }
    }
}