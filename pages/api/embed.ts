import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

import { KeyConfiguration, ModelType } from '@/types';
import { getVectorStore, populateVectorStore } from '@/utils/vector';
import { getGlobalVectorStore, setGlobalVectorStore } from '@/utils/globalVectorStore';
import { SERVICES_DOCUMENTS_FOLDER_PATH } from '@/utils/app/const';

const folderPath = SERVICES_DOCUMENTS_FOLDER_PATH || '/Volumes/Stuff/Development/office/rta/IDOS/Latest/'; // Default path as a fallback

export const config = {
    api: {
        bodyParser: false,
    }
};


const keyConfiguration: KeyConfiguration = {
  apiType: ModelType.AZURE_OPENAI,
  azureApiKey: process.env.AZURE_OPENAI_API_KEY!,
  azureDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME!,
  azureEmbeddingDeploymentName:
    process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME!,
  azureInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
  azureApiVersion: process.env.AZURE_OPENAI_API_VERSION!
};


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
        try {
            // Function to check if files have been changed or updated
        const checkFiles = async () => {

            var filesToCheck = ['en/All_services_list.json', 'ar/All_services_list.json', 'en/All_services_list_gai.json', 'ar/All_services_list_gai.json'];

            var hasBeenModified = false;

            var filesMetaData = await Promise.all(filesToCheck.map(async (file) => {
                const filePath = path.join(folderPath, file);
                try {
                    const stats = await fs.promises.stat(filePath);
                    const lastModified = stats.mtime;
                    var lastModifiedDate = new Date(lastModified).toISOString();
                    return { file, lastModifiedDate };
                } catch (err) {
                    console.error(err);
                    return { file, lastModifiedDate: null };
                }
            }));

            if (fs.existsSync(path.join(folderPath, 'servicesFilesMetaData.json'))) {
                var servicesFilesMetaData = JSON.parse(fs.readFileSync(path.join(folderPath, 'servicesFilesMetaData.json'), 'utf8'));
                filesMetaData.forEach((fileMetaData) =>  {
                    const existingFileMetaData = servicesFilesMetaData.find((metaData: { file: string; lastModifiedDate: Date | null; }) => metaData.file === fileMetaData.file);
                    if (existingFileMetaData.lastModifiedDate !== fileMetaData.lastModifiedDate) {
                        hasBeenModified = true;
                    }else{
                        hasBeenModified = false;
                    }
                });
            } else {
                hasBeenModified = true;
            }
            
            if (hasBeenModified) {
                console.log('File(s) modified at ' + new Date());
                console.log('Populating Vectors from Documents...');
                var vectorStore = await populateVectorStore(keyConfiguration);
                setGlobalVectorStore(vectorStore);
            }else{
                console.log('No Files Modified');
            }
            fs.writeFileSync(path.join(folderPath, 'servicesFilesMetaData.json'), JSON.stringify(filesMetaData));  
        };

        // Schedule the file checker to run every 6 hours, but run it first 
        checkFiles();
        cron.schedule('0 */6 * * *', checkFiles);
        console.log('Scheduled automatic embedding to run every 6 hours');
        res.status(200).json({ message: 'Automatic Embedding started' });

        } catch (error) {
            console.error('Error during file embedding:', error);
            return res.status(500).json({ message: 'Error during file embedding' });
        }
    } else if (req.method === 'GET') {
        // Get the vector store content and return it
        var vectorStoreContent = getGlobalVectorStore();

        if (!vectorStoreContent) {
            vectorStoreContent = await getVectorStore(keyConfiguration);
            setGlobalVectorStore(vectorStoreContent!);
        }

        if (!vectorStoreContent) {
            console.error('No vector store found');
            return res.status(500).json({ message: 'No vector store found' });
        }

        var documentsMetaData = vectorStoreContent.memoryVectors.map((memoryVector: any) => memoryVector.metadata);

        var documentsCountPerLanguageAndType = documentsMetaData.reduce((acc: any, curr: any) => {
            const key = `${curr.language}-${curr.type}`;
            if (!acc[key]) {
                acc[key] = 0;
            }
            acc[key]++;
            return acc;
        }, {});

        console.log('Vector store content retrieved successfully');

        res.status(200).json({ success: true, totalDocuments: vectorStoreContent.memoryVectors.length, details: documentsCountPerLanguageAndType});
        
    } else {
        res.setHeader('Allow', ['POST', 'GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};

export default handler;
