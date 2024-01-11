import type { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import fs from 'fs';
import {SERVICES_DOCUMENTS_FOLDER_PATH } from "@/utils/app/const";
import { getSplitterDocument } from '@/utils/langchain/splitter';
import { deleteChromaCollectionIfExists, saveEmbeddingsChroma, saveEmbeddingsLocally, countDocumentsInChromaCollection, deleteDocumentsFromChromaCollection, countDocumentsByMetadata } from '@/utils/vector';
import { KeyConfiguration, ModelType } from '@/types';
import path from 'path';
import { updateStatusText } from '@/utils/app/logging';

export const config = {
    api: {
        bodyParser: false,
    }
};


const handler = async (req: NextApiRequest, res: NextApiResponse) => {

    if (req.method === 'GET') {
            try {            
               
                res.status(200).json({ totalDocuments: await countDocumentsInChromaCollection(), totalDocumentsByType: await countDocumentsByMetadata() });
            } catch (error) {
                console.error('Error during file embedding:', error);
                return res.status(500).json({ message: 'Error during file embedding' });
            }       
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};

export default handler;
