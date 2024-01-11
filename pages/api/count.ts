import type { NextApiRequest, NextApiResponse } from 'next';

import { countDocumentsInChromaCollection,countDocumentsByMetadata, collectionExists } from '@/utils/vector';


export const config = {
    api: {
        bodyParser: false,
    }
};


const handler = async (req: NextApiRequest, res: NextApiResponse) => {

    if (req.method === 'GET') {
            try {            
                if(await collectionExists()){              
                    res.status(200).json({ totalDocuments: await countDocumentsInChromaCollection(), totalDocumentsByType: await countDocumentsByMetadata() });
                }else{
                    res.status(200).json({message: "Collection does not exist"});
                }
            } catch (error) {
                console.error('Error getting count from Chroma:', error);
                return res.status(500).json({ message: 'Error getting count from Chroma' });
            }       
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};

export default handler;
