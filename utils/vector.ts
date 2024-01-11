import { Chroma } from "langchain/vectorstores/chroma";
import {MemoryVectorStore} from "langchain/vectorstores/memory";
import {Document} from "langchain/dist/document";
import {CHROMA_URL} from "@/utils/app/const";
import {updateProgressBar, updateStatusText} from "@/utils/app/logging";
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

export const saveEmbeddingsLocally = async (keyConfiguration: KeyConfiguration, documents: Document[]) => {
    try{
        const vectorStore = new MemoryVectorStore(await getEmbeddings(keyConfiguration));
       
       
        for (const doc of documents) {
            console.log("Adding document to Chroma");
            console.log(doc);
            await vectorStore.addDocuments([doc]);
        }
    }catch(error){
        console.log("Error Initializing Local Store");
    }
}

export const saveEmbeddingsChroma = async (keyConfiguration: KeyConfiguration, documents: Document[]) => {
    try{
        const vectorStore = new Chroma(await getEmbeddings(keyConfiguration), {
            collectionName: "documents_collection",
            url: chromaURl,
            });
        updateStatusText("Initializing Chroma with collection documents_collection");
        const totalDocuments = documents.length;
        let currentDocument = 0;
        for (const doc of documents) {
            currentDocument++;
            updateProgressBar(currentDocument, totalDocuments);
            await vectorStore.addDocuments([doc]);
            
        }
        updateStatusText(documents.length +"Initializing Chroma with collection documents_collection");
    }catch(error){
        updateStatusText("Error Initializing Chroma with collection documents_collection");
    }
}


// function to delete collection documents_collection if exists
export const deleteChromaCollectionIfExists = async () => {
    try{
        const collectionExists = await chromaClient.getCollection({name:"documents_collection"});
        updateStatusText("Collection documents_collection exists?: " + collectionExists? "Yes" : "No");
        if (collectionExists) {
            updateStatusText("Deleting Collection documents_collection");
            await chromaClient.deleteCollection({name: "documents_collection"});
            updateStatusText("Collection documents_collection deleted");
        }
    } catch(error){
        updateStatusText("Collection documents_collection does not exist");
    }
}

export const countDocumentsInChromaCollection = async () => {
    const collection = await chromaClient.getCollection({name:"documents_collection"});
    if(!collection) {
        return 0;
    }
    const count = await collection.count();
    return count;
}

export const deleteDocumentsFromChromaCollection = async (type?: string, language ?: string) => {

    var filterObject = {};
    // build filter object based on type and language if provided
    if (type && language) {
        filterObject = {"$and": [{serviceType: {"$eq":type}}, {language: {"$eq":language}}]};
    } else if (type) {
        filterObject = { serviceType: type };
    } else if (language) {
        filterObject = { language: language };
    }
    
    const collection = await chromaClient.getCollection({name:"documents_collection"});
    // Output the number of documents in the collection
    const count = await collection.count();
    updateStatusText("Number of documents in the collection: (Before Deletion)" + count );
    // If neither type nor language is provided, delete all documents
    if (!type && !language) {
        updateStatusText("Deleting all Documents from Collection documents_collection");
        await chromaClient.deleteCollection({name: "documents_collection"});
    }else{
        updateStatusText("Deleting Documents from Collection documents_collection");
       await collection.delete({where: filterObject});
    }
    const countAfter = await collection.count();
    updateStatusText("Number of documents in the collection (After Deletion): " + countAfter );
    
    updateStatusText(type+" Documents deleted from Collection documents_collection");
    
}