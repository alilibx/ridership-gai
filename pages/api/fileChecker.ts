import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SERVICES_DOCUMENTS_FOLDER_PATH } from '@/utils/app/const';
import { populateVectorStore } from '@/utils/vector';
import { KeyConfiguration, ModelType } from '@/types';
import { setGlobalVectorStore } from '@/utils/globalVectorStore';

const folderPath = SERVICES_DOCUMENTS_FOLDER_PATH || '/Volumes/Stuff/Development/office/rta/IDOS/Latest/'; // Default path as a fallback


const keyConfiguration: KeyConfiguration = {
    apiType: ModelType.AZURE_OPENAI,
    azureApiKey: process.env.AZURE_OPENAI_API_KEY!,
    azureDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME!,
    azureEmbeddingDeploymentName:
      process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME!,
    azureInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
    azureApiVersion: process.env.AZURE_OPENAI_API_VERSION!
  };

const fileChecker = async (req: NextApiRequest, res: NextApiResponse) => {

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
            if (existingFileMetaData && existingFileMetaData.lastModifiedDate !== fileMetaData.lastModifiedDate) {
                hasBeenModified = true;
                existingFileMetaData.lastModifiedDate = fileMetaData.lastModifiedDate;
            } else if (!existingFileMetaData) {
                servicesFilesMetaData.push(fileMetaData);
                hasBeenModified = true;
            }
        });
        fs.writeFileSync(path.join(folderPath, 'servicesFilesMetaData.json'), JSON.stringify(servicesFilesMetaData));
    } else {
        fs.writeFileSync(path.join(folderPath, 'servicesFilesMetaData.json'), JSON.stringify(filesMetaData));
    }
    
    if (hasBeenModified) {
       console.log('File(s) modified at ' + new Date());
       console.log('Populating Vectors from Documents...');
       var vectorStore = await populateVectorStore(keyConfiguration);
       setGlobalVectorStore(vectorStore);
       console.log('Vectors populated successfully');
       console.log('Global Vector store ')
    }else{
        console.log('No Files Modified');
    }        
   };

    // Schedule the file checker to run every 6 hours
    cron.schedule('0 */6 * * *', checkFiles);
    res.status(200).json({ message: 'File checker scheduled.' });

}

export default fileChecker;