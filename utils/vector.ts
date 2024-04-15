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