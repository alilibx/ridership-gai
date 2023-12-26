import type { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import fs from 'fs';
import {SERVICES_DOCUMENTS_FOLDER_PATH } from "@/utils/app/const";
import { getDocumentLoader } from '@/utils/langchain/documentLoader';
import { getSplitterDocument } from '@/utils/langchain/splitter';
import { deleteCollectionIfExists, saveEmbeddings } from '@/utils/vector';
import { KeyConfiguration, ModelType } from '@/types';
import path from 'path';

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
};


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    console.log("Beginning files handler");

    const englishFilePath = path.join(folderPath, 'en/All_services_list.json');
    const arabicFilePath = path.join(folderPath, 'ar/All_services_list.json');

    if (req.method === 'POST') {
            try {
                // Delete the collection if exists
                deleteCollectionIfExists();

                // Embedding the English file
                await embeddFile(englishFilePath);
                console.log('English Services Embedded successfully');

                // Embedding the Arabic file
                await embeddFile(arabicFilePath);
                console.log('Arabic Services Embedded successfully');
        
                res.status(200).json({ message: 'Document Embedding for IDOS Services processed successfully', filePath: englishFilePath });
            } catch (error) {
                console.error('Error during file embedding:', error);
                return res.status(500).json({ message: 'Error during file embedding' });
            }       
    } else if (req.method === 'DELETE') {
        deleteCollectionIfExists();
        console.log('Collection deleted successfully');
        res.status(200).json({ message: 'Collection deleted successfully' });
    } else {
        res.setHeader('Allow', ['POST', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};

function extractData(text: string): { unique_id: string, name: string } {
    const uniqueIdRegex = /unique_id:\s*([^\n]+)/;
    const nameRegex = /name:\s*([^\n]+)/;

    const uniqueIdMatch = text.match(uniqueIdRegex);
    const nameMatch = text.match(nameRegex);

    return {
        unique_id: uniqueIdMatch ? uniqueIdMatch[1].trim() : '',
        name: nameMatch ? nameMatch[1].trim() : ''
    };
}

const embeddFile = async (filePath: string) => {
    console.log("Beginning embedding handler");

    const fileContent = extractContentFromJsonFile(filePath);
    console.log("File content extracted successfully");

    // Generate documents from the file content
    const documents = fileContent.map((content: any) => {
        return {
            pageContent: content.content,
            metadata: content.metadata,
        };
    });
    console.log("Documents generated successfully");
    const splitDocuments = await getSplitterDocument(keyConfiguration, documents);
    console.log("Documents splitted successfully");
    try {
        await saveEmbeddings(keyConfiguration, splitDocuments);
        console.log("Embedding saved successfully");
    } catch (e) {
        console.error('Error saving embeddings:', e);
        throw e; // Rethrow to handle in the calling function
    }
}

// This function takes a JSON file and returns an array of objects each object has one string property called "content" with combined content of all the fields in each object in the JSON Array
const extractContentFromJsonFile = (filePath: string) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonArray = JSON.parse(fileContent).allservices;
    const contentArray = jsonArray.map((item: any) => {
        const fields = Object.keys(item);
        // If the field is 'channels' then join the array of channel name and desciptions in to one string 
        const content = fields
            .filter((field) => field !== 'channels')
            .map((field) => item[field])
            .join(' ');

        // if the field is 'channels' then join the array of channel name and desciptions in to one string
        const channels = fields
            .filter((field) => field === 'channels')
            .map((field) => item[field].map((channel: any) => channel.title + ' ' + channel.description).join(' '))
            .join(' ');

        // Add the channels string to the content string
        content.concat(channels);

        return { content, metadata: { unique_id: item.unique_id, name: item.name } };
    });
    return contentArray;
}

export default handler;
