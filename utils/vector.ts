import { Chroma } from "langchain/vectorstores/chroma";
import {Document} from "langchain/dist/document";
import {CHROMA_URL} from "@/utils/app/const";
import {getEmbeddings} from "@/utils/embeddings";
import { KeyConfiguration } from "@/types";
import { ChromaClient } from 'chromadb'

const chromaURl = CHROMA_URL || 'http://localhost:8000';  
const chromaClient = new ChromaClient({path: chromaURl});


export const getExistingVectorStore = async (keyConfiguration: KeyConfiguration) => {
    var chromaURl = CHROMA_URL || 'http://localhost:8000';
    return await Chroma.fromExistingCollection(
    await getEmbeddings(keyConfiguration),
    { collectionName: "documents_collection" }
    );
}

export const saveEmbeddings = async (keyConfiguration: KeyConfiguration, documents: Document[]) => {
    try{
        const vectorStore = new Chroma(await getEmbeddings(keyConfiguration), {
            collectionName: "documents_collection",
            url: chromaURl,
            });
        console.log("Initializing Chroma with collection documents_collection");
        for (const doc of documents) {
            console.log("Adding document to Chroma");
            console.log(doc);
            await vectorStore.addDocuments([doc]);
        }
    }catch(error){
        console.log("Error Initializing Chroma with collection documents_collection");
    }
}


// function to delete collection documents_collection if exists
export const deleteCollectionIfExists = async () => {
    try{
        const collectionExists = await chromaClient.getCollection({name:"documents_collection"});
        console.log("Collection exists?: ", collectionExists);
        if (collectionExists) {
            console.log("Deleting collection documents_collection");
            await chromaClient.deleteCollection({name: "documents_collection"});
            console.log("Collection documents_collection deleted successfully");
        }
    } catch(error){
        console.log("Error deleting collection documents_collection");
    }
}