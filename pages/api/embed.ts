import type { NextApiRequest, NextApiResponse } from 'next';

import { KeyConfiguration, ModelType } from '@/types';

import { updateStatusText } from '@/utils/app/logging';
import { getVectorStore, populateVectorStore } from '@/utils/vector';
import { getGlobalVectorStore, setGlobalVectorStore } from '@/utils/globalVectorStore';


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
            var vectorStore = populateVectorStore(keyConfiguration);
            
            return res.status(200).json({ success: true, totalDocuments: (await vectorStore).memoryVectors.length});

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
            return res.status(500).json({ message: 'No vector store found' });
        }

        res.status(200).json({ success: true, totalDocuments: (await vectorStoreContent).memoryVectors.length});
        
    } else {
        res.setHeader('Allow', ['POST', 'GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};

export default handler;
