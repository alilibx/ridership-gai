import type { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import fs from 'fs';
import {NEXT_PUBLIC_CHAT_FILES_UPLOAD_PATH } from "@/utils/app/const";
import { getDocumentLoader } from '@/utils/langchain/documentLoader';
import { getSplitterDocument } from '@/utils/langchain/splitter';
import { deleteCollectionIfExists, saveEmbeddings } from '@/utils/vector';
import { KeyConfiguration, ModelType } from '@/types';
import path from 'path';

interface NextApiRequestWithFile extends NextApiRequest {
    file: Express.Multer.File; // Using the correct Multer file type
}

export const config = {
    api: {
        bodyParser: false,
    }
};

const folderPath = NEXT_PUBLIC_CHAT_FILES_UPLOAD_PATH || 'default/path/'; // Default path as a fallback

const keyConfiguration: KeyConfiguration = {
  apiType: ModelType.AZURE_OPENAI,
  azureApiKey: process.env.AZURE_OPENAI_API_KEY!,
  azureDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME!,
  azureEmbeddingDeploymentName:
    process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME!,
  azureInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME!,
  azureApiVersion: process.env.AZURE_OPENAI_API_VERSION!,
};

// Multer configuration for file uploading
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, folderPath);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname)); // Use original file extension
        },
    }),
});

const handler = async (req: NextApiRequestWithFile, res: NextApiResponse) => {
    console.log("Beginning files handler");

    if (req.method === 'POST') {
        upload.single('file')(req as any, res as any, async (err: any) => {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            
            const uploadedFile = req.file; // Access the uploaded file details here
            if (!uploadedFile) {
                return res.status(400).json({ message: 'No file uploaded' });
            }
        
            try {
                // Embedding the file
                await embeddFile(uploadedFile.filename, path.extname(uploadedFile.originalname));
                console.log('File Embedded successfully');
        
                // Delete the file from the server
                fs.unlink(path.join(folderPath, uploadedFile.filename), (unlinkErr) => {
                    if (unlinkErr) {
                        console.error('Error deleting the file:', unlinkErr);
                    } else {
                        console.log('File deleted successfully');
                    }
                });
        
                res.status(200).json({ message: 'File uploaded and processed successfully', filePath: path.join(folderPath, uploadedFile.filename) });
            } catch (error) {
                console.error('Error during file embedding:', error);
                return res.status(500).json({ message: 'Error during file embedding' });
            }
        });        
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

const embeddFile = async (fileName: string, fileType: string) => {
    console.log("Beginning embedding handler");

    const loader = getDocumentLoader(fileType, path.join(folderPath, fileName));
    const document = await loader.load();
    const splitDocuments = await getSplitterDocument(keyConfiguration, document);
    splitDocuments.forEach((doc) => {
        doc.metadata = { file_name: fileName, ...extractData(doc.pageContent) };
    });
    try {
        await saveEmbeddings(keyConfiguration, splitDocuments);
        console.log("Embedding saved successfully");
    } catch (e) {
        console.error('Error saving embeddings:', e);
        throw e; // Rethrow to handle in the calling function
    }
}

export default handler;
