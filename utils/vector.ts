import { Chroma } from "langchain/vectorstores/chroma";
import {MemoryVectorStore} from "langchain/vectorstores/memory";
import {Document} from "langchain/dist/document";
import {CHROMA_URL, SERVICES_DOCUMENTS_FOLDER_PATH} from "@/utils/app/const";
import {updateProgressBar, updateStatusText} from "@/utils/app/logging";
import {getEmbeddings} from "@/utils/embeddings";
import { KeyConfiguration, VectorStoreTypes } from "@/types";
import { ChromaClient } from 'chromadb';
import fs from 'fs';
import path from 'path';
import { extractContentFromJsonFile } from "@/utils/app/files";
import { getSplitterDocument } from "@/utils/langchain/splitter";

const chromaURl = CHROMA_URL || 'http://localhost:8000';  
const chromaClient = new ChromaClient({path: chromaURl});
const folderPath = SERVICES_DOCUMENTS_FOLDER_PATH || '/Volumes/Stuff/Development/office/rta/IDOS/Latest/'; // Default path as a fallback



export const getExistingVectorStore = async (keyConfiguration: KeyConfiguration) => {
    //if(keyConfiguration.vectorStoreType === VectorStoreTypes.memory){
        
        const englishFilePath = path.join(folderPath, 'en/All_services_list.json');
        const arabicFilePath = path.join(folderPath, 'ar/All_services_list.json');
        const nonIdosEnglishFilePath = path.join(folderPath, 'en/All_services_list_gai.json');
        const nonIdosArabicFilePath = path.join(folderPath, 'ar/All_services_list_gai.json');

        var englishFileContents = extractContentFromJsonFile(englishFilePath);
        var arabicFileContents = extractContentFromJsonFile(arabicFilePath);
        var nonIdosEnglishFileContents = extractContentFromJsonFile(nonIdosEnglishFilePath);
        var nonIdosArabicFileContents = extractContentFromJsonFile(nonIdosArabicFilePath);

        // combine the file contents into a single array
        const documents = englishFileContents.concat(arabicFileContents, nonIdosEnglishFileContents, nonIdosArabicFileContents);

        const processedDocuments = documents.map((content: any) => {
            return {
                pageContent: content.content,
                metadata: content.metadata
            };
        });
        updateStatusText("Documents generated successfully");
        const splitDocuments = await getSplitterDocument(keyConfiguration, processedDocuments);

        var memoryVectorStore = await MemoryVectorStore.fromDocuments(splitDocuments, await getEmbeddings(keyConfiguration));
        return memoryVectorStore;
    
}

export const saveEmbeddings = async (keyConfiguration: KeyConfiguration, documents: Document[]) => {
    if (keyConfiguration.vectorStoreType === VectorStoreTypes.memory) {
        try{

            const vectorStore = await MemoryVectorStore.fromDocuments(documents, await getEmbeddings(keyConfiguration));

            // Store vectorStore.memoryVectors  in a json file in the data folder in the root directory
            fs.appendFileSync(path.join(process.cwd(), 'data', 'memoryVectors.json'), JSON.stringify(vectorStore.memoryVectors));
            
           
            updateStatusText(documents.length +" Documents added to Local Store");
        }catch(error){
            console.log("Error Initializing Local Store");
        }
    } else if (keyConfiguration.vectorStoreType === VectorStoreTypes.chroma) {
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
}


export const collectionExists = async () => {
    const collectionExists = await chromaClient.listCollections();
    if(collectionExists.length == 0 || !collectionExists.find((collection) => collection.name === "documents_collection")){
        return false;
    }else{
        return true;
    }
}


// function to delete collection documents_collection if exists
export const deleteChromaCollectionIfExists = async () => {
    try{
        const isCollectionExists = await collectionExists();
        if (isCollectionExists) {
            updateStatusText("Deleting Collection documents_collection");
            await chromaClient.deleteCollection({name: "documents_collection"});
            updateStatusText("Collection documents_collection deleted");
        }else{
            updateStatusText("Collection documents_collection does not exist");
            return "Collection documents_collection does not exist";
        }
    } catch(error){
        updateStatusText("Collection documents_collection does not exist");
        return error;
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

export const countDocumentsByMetadata= async() =>{

    const collection = await chromaClient.getCollection({name:"documents_collection"});
   
    if(!collection) {
        return 0;
    }

    // Get Documents from collection 
    const response = await collection.get();
    const metadata = response.metadatas;
    // Now from the metadata count the number of documents based on serviceType and language
    const countByServiceTypeAndLanguage: Record<string, Record<string, number>> = {};

  metadata.forEach((item) => {
    const { serviceType, language } = item ?? {};
    if (serviceType && language) {
      if (!countByServiceTypeAndLanguage[String(serviceType)]) {
        countByServiceTypeAndLanguage[String(serviceType)] = {};
      }
      if (!countByServiceTypeAndLanguage[String(serviceType)][String(language)]) {
        countByServiceTypeAndLanguage[String(serviceType)][String(language)] = 0;
      }
      countByServiceTypeAndLanguage[String(serviceType)][String(language)]++;
    }
  });

    

    console.log(countByServiceTypeAndLanguage);
    return countByServiceTypeAndLanguage;
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
    try{
        if (collection) {
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
        }else{
            updateStatusText("Collection documents_collection does not exist");
        }
    } catch(error){
        updateStatusText("Error deleting documents from Collection documents_collection");
    }
}