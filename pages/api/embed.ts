import type { NextApiRequest, NextApiResponse } from 'next';

import {SERVICES_DOCUMENTS_FOLDER_PATH } from "@/utils/app/const";
import { getSplitterDocument } from '@/utils/langchain/splitter';
import { deleteChromaCollectionIfExists, saveEmbeddings, countDocumentsInChromaCollection, deleteDocumentsFromChromaCollection } from '@/utils/vector';
import { KeyConfiguration, ModelType, VectorStoreTypes } from '@/types';
import path from 'path';
import { updateStatusText } from '@/utils/app/logging';
import { extractContentFromJsonFile } from '@/utils/app/files';

export const config = {
    api: {
        bodyParser: false,
    }
};

const folderPath = SERVICES_DOCUMENTS_FOLDER_PATH || '/Users/ali/Development/office/rta/IDOS/Latest/'; // Default path as a fallback

const keyConfiguration: KeyConfiguration = {
  apiType: ModelType.AZURE_OPENAI,
  azureApiKey: process.env.AZURE_OPENAI_API_KEY!,
  azureDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME!,
  azureEmbeddingDeploymentName:
    process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME!,
  azureInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
  azureApiVersion: process.env.AZURE_OPENAI_API_VERSION!,
  vectorStoreType: VectorStoreTypes.memory
};


const handler = async (req: NextApiRequest, res: NextApiResponse) => {

    const englishFilePath = path.join(folderPath, 'en/All_services_list.json');
    const arabicFilePath = path.join(folderPath, 'ar/All_services_list.json');
    const nonIdosEnglishFilePath = path.join(folderPath, 'en/All_services_list_gai.json');
    const nonIdosArabicFilePath = path.join(folderPath, 'ar/All_services_list_gai.json');

    const type = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
    const language = Array.isArray(req.query.language) ? req.query.language[0] : req.query.language;

    if (req.method === 'POST') {
            try {            
                // Delete the collection if exists
                //deleteChromaCollectionIfExists();

                // Embedding the English file
                if ((type === 'all' || type === 'idos' || !type) && (language === 'en' || !language)) {
                updateStatusText('Embedding English Services Documents...');
                await embeddFile(englishFilePath, "idos", "en");
                updateStatusText('English Services Embedded successfully');
                }
                
                // Embedding the Arabic file
                if ((type === 'all' || type === 'idos' || !type) && (language === 'ar' || !language)) {
                updateStatusText('Embedding Arabic Services Documents...');
                await embeddFile(arabicFilePath , "idos", "ar");
                updateStatusText('Arabic Services Embedded successfully');
                }
                
                // Embedding the Non Idos English file
                if ((type === 'all' || type === 'nonIdos' || !type) && (language === 'en' || !language)) {
                await embeddFile(nonIdosEnglishFilePath , "nonIdos", "en");
                updateStatusText('Non IDOS English Services Embedded successfully');
                }
                
                // Embedding the Non Idos Arabic file
                if ((type === 'all' || type === 'nonIdos' || !type) && (language === 'ar' || !language)) {
                await embeddFile(nonIdosArabicFilePath , "nonIdos", "ar");
                updateStatusText('Non IDOS Arabic Services Embedded successfully');
                }
                res.status(200).json({ message: (await countDocumentsInChromaCollection()).toString() + ' Documents Embedded successfully'});
            } catch (error) {
                console.error('Error during file embedding:', error);
                return res.status(500).json({ message: 'Error during file embedding' });
            }       
    } else if(req.method === 'DELETE'){
        // Delete the collection if exists
        var message = await deleteChromaCollectionIfExists();
        res.send({ message: message});
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};


const embeddFile = async (filePath: string, type?: string, language?: string) => {
    updateStatusText("Beginning embedding handler");

    const fileContent = extractContentFromJsonFile(filePath);
    // If file doesnt   exist return an empty array
    if (!fileContent) {
        updateStatusText("File content not found");
        return;
    }
    updateStatusText("File content extracted successfully");

    // Generate documents from the file content
    const documents = fileContent.map((content: any) => {
        // Append type and language to the metadata 
        const metadata = {
            ...content.metadata,
            serviceType: type,
            language: language
        }
        return {
            pageContent: content.content,
            metadata: metadata
        };
    });
    updateStatusText("Documents generated successfully");
    const splitDocuments = await getSplitterDocument(keyConfiguration, documents);
    updateStatusText("Documents splitted successfully");
    try {
        await saveEmbeddings(keyConfiguration, splitDocuments);
        updateStatusText("Embedding saved successfully");
    } catch (e) {
        console.error('Error saving embeddings:', e);
        throw e; // Rethrow to handle in the calling function
    }
}

// This function takes a JSON file and returns an array of objects each object has one string property called "content" with combined content of all the fields in each object in the JSON Array


export default handler;
