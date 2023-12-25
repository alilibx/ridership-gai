import { SupabaseVectorStore} from "langchain/vectorstores/supabase";
import { Chroma } from "langchain/vectorstores/chroma";
import {createClient} from "@supabase/supabase-js";
import {Document} from "langchain/dist/document";
import {SUPABASE_KEY, SUPABASE_URL, CHROMA_URL} from "@/utils/app/const";
import {getEmbeddings} from "@/utils/embeddings";
import { KeyConfiguration, ModelType } from "@/types";
import { ChromaClient } from 'chromadb'

const chromaURl = CHROMA_URL || 'http://localhost:8000';  
const chromaClient = new ChromaClient({path: chromaURl});
const client = createClient(SUPABASE_URL!, SUPABASE_KEY!);


export const getExistingVectorStore = async (keyConfiguration: KeyConfiguration, isMemory : boolean) => {
    if (isMemory) {
          var chromaURl = CHROMA_URL || 'http://localhost:8000';
          return await Chroma.fromExistingCollection(
            await getEmbeddings(keyConfiguration),
            { collectionName: "documents_collection" }
          );
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
        
        const vectorStore = new Chroma(await getEmbeddings(keyConfiguration), {
            collectionName: "documents_collection",
            url: chromaURl, // Optional, will default to this value
          });

        for (const doc of documents) {
            console.log("Adding document to Chroma");
            console.log(doc);
            await vectorStore.addDocuments([doc]);
        }

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


// function to delete collection from Chroma
export const deleteCollection = async () => {
    await chromaClient.listCollections().then(async (collections) => {
        for (const collection of collections) {
            await chromaClient.deleteCollection({name: collection.name});
        }
    });
}