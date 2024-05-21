import {MemoryVectorStore} from "langchain/vectorstores/memory";
import { SERVICES_DOCUMENTS_FOLDER_PATH} from "@/utils/app/const";
import {updateProgressBar, updateStatusText} from "@/utils/app/logging";
import {getEmbeddings} from "@/utils/embeddings";
import { KeyConfiguration, VectorStoreTypes } from "@/types";
import fs from 'fs';
import path from 'path';
import { extractContentFromJsonFile } from "@/utils/app/files";
import { getSplitterDocument } from "@/utils/langchain/splitter";
import { CSVLoader } from "langchain/document_loaders/fs/csv";

const folderPath = SERVICES_DOCUMENTS_FOLDER_PATH || '/Volumes/Stuff/Development/office/rta/docs/Projects/Ridership/'; // Default path as a fallback


export const getVectorStore = async (keyConfiguration: KeyConfiguration) => {

    try{
        // If memoryVectors.json exists, load it
        if (fs.existsSync(path.join(folderPath, 'memoryVectors.json'))) {
            const memoryVectors = JSON.parse(fs.readFileSync(path.join(folderPath, 'memoryVectors.json'), 'utf8'));
            const vectorStore = new MemoryVectorStore(await getEmbeddings(keyConfiguration));
            vectorStore.memoryVectors = memoryVectors;
            return vectorStore;
        }
        return populateVectorStore(keyConfiguration);    

    } catch (error) {
        console.error('Error during vector store retrieval:', error);
        return null;
    }     
}

export const getFilteredData = async (keyConfiguration: KeyConfiguration, filter : any) => {

   try{

    var filePath = path.join(folderPath, 'april24ridership.csv');
    // Load the CSV file
    const csvLoader = new CSVLoader(filePath);

    const documents = await csvLoader.load();
    

   } catch (error) {
        console.error('Error during getting filtered data:', error);
        return null;
    }
    
}


export const populateVectorStore = async (keyConfiguration: KeyConfiguration) => {
    try{

    // If memoryVectors.json exists, load it
    if (fs.existsSync(path.join(folderPath, 'memoryVectors.json'))) {
       // Delete the file if it exists
        fs.unlinkSync(path.join(folderPath, 'memoryVectors.json'));
        updateStatusText("All Existing Vectors deleted successfully");       
    }

    updateStatusText("Populating Vectors from Documents...");
    
    const englishFilePath = path.join(folderPath, 'en/All_services_list.json');
    const arabicFilePath = path.join(folderPath, 'ar/All_services_list.json');
    const nonIdosEnglishFilePath = path.join(folderPath, 'en/All_services_list_gai.json');
    const nonIdosArabicFilePath = path.join(folderPath, 'ar/All_services_list_gai.json');

    updateStatusText("Extracting Content from JSON Files ...");

    var englishFileContents = extractContentFromJsonFile(englishFilePath, "idos", "en");
    var arabicFileContents = extractContentFromJsonFile(arabicFilePath, "idos", "ar");
    var nonIdosEnglishFileContents = extractContentFromJsonFile(nonIdosEnglishFilePath, "non_idos", "en");
    var nonIdosArabicFileContents = extractContentFromJsonFile(nonIdosArabicFilePath, "non_idos", "ar");

    // combine the file contents into a single array
     const documents = englishFileContents.concat(arabicFileContents, nonIdosEnglishFileContents, nonIdosArabicFileContents);
    //const documents = extractContentFromJsonFile(nonIdosEnglishFilePath, "non_idos", "en");
    const processedDocuments = documents.map((content: any) => {
        return {
            pageContent: content.content,
            metadata: content.metadata
        };
    });
    updateStatusText("Splitting Documents ...");
    const splitDocuments = await getSplitterDocument(keyConfiguration, processedDocuments);

    updateStatusText("Embedding Documents ...");
    
    var memoryVectorStore = await MemoryVectorStore.fromDocuments(splitDocuments, await getEmbeddings(keyConfiguration));

    updateProgressBar(0, memoryVectorStore.memoryVectors.length);
    var memoryVectors = memoryVectorStore.memoryVectors;

    // save memory vectors to json file in the /data/assets folder
    fs.writeFileSync(
        path.join(folderPath, 'memoryVectors.json'),
        JSON.stringify(memoryVectors, null, 2),
    );

    updateStatusText("Vector Store populated successfully");
    return memoryVectorStore;

    } catch (error) {
        console.error('Error populating vector store:', error);
        throw error;
    }
}