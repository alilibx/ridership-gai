import type {NextApiRequest, NextApiResponse} from 'next'
import multer from "multer";
import fs from 'fs';
import {ISMEMORY_VECTOR_STORE, NEXT_PUBLIC_CHAT_FILES_UPLOAD_PATH} from "@/utils/app/const";
import { getKeyConfiguration } from '@/utils/app/configuration';
import { getDocumentLoader } from '@/utils/langchain/documentLoader';
import { getSplitterDocument } from '@/utils/langchain/splitter';
import { saveEmbeddings } from '@/utils/vector';
import { KeyConfiguration, ModelType } from '@/types';
import {v4 as uuidv4} from 'uuid';

export const config = {
    api: {
        bodyParser: false,
    }
};

const folderPath = NEXT_PUBLIC_CHAT_FILES_UPLOAD_PATH!;

const keyConfiguration: KeyConfiguration = {
    apiKey: process.env.OPENAI_API_KEY!,
    apiType: ModelType.OPENAI,
};

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, folderPath);
        },
        filename: (req, file, cb) => {
            cb(null, req.query.fileName as string);
        },
    }),
});

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    console.log("beginning files handler");

    if (req.method === 'POST') {
        const fileName = uuidv4();
        req.query.fileName = fileName;
        const data = await req.formData()
        const file: File | null = data.get('file') as unknown as File
      
        const fileType = formData.file.name.split('.').pop()!;

        upload.single('file')(req as any, res as any, (err: any) => {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            // File uploaded successfully. Return the file name with full path
            console.log('File uploaded successfully')
            embeddFile(fileName as string, fileType as string);
            console.log('File Embedded successfully');
            // Delete the file from the server
            fs.unlink(`${folderPath}/${fileName as string}`, (err) => {
                if (err) {
                    console.error(err);
                    return res.status(400).json({ message: err.message });
                }
                console.log('File deleted successfully');
            });
            console.log('File deleted successfully');
            res.status(200).json({ message: 'File uploaded successfully' , filePath: `${folderPath}/${req.query.fileName as string}`});
        });
    } else if (req.method === 'DELETE') {
        const filePath = `${folderPath}/${req.query.fileName as string}`;
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(err);
                    return res.status(400).json({ message: err.message });
                }
                res.status(200).json({ message: 'File deleted successfully' });
                console.log('File deleted successfully');
            });
        } else {
            res.status(404).json({ message: 'File Not Found' });
            console.log('File does not exist');
        }
    }

}


const embeddFile = async (fileName: string, fileType: string) => {
    console.log("beginning embedding handler");

    const loader = getDocumentLoader(fileType, `${folderPath}/${fileName}.${fileType}`);
    const document = await loader.load();
    const splitDocuments = await getSplitterDocument(keyConfiguration, document);
    splitDocuments.map((doc) => {
        doc.metadata = { file_name : fileName };
    });
    try {
        await saveEmbeddings(keyConfiguration, splitDocuments, ISMEMORY_VECTOR_STORE);
        console.log("Embedding Saved Successfully");
    } catch (e) {
        console.error(e);
    }
}

export default handler;

