
import type { NextApiRequest, NextApiResponse } from 'next';
import { getExistingVectorStore } from '@/utils/vector';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        // Get the body from the request
    } catch (error) {
        console.error('Error during query:', error);
        return res.status(500).json({ message: 'Error during query' });
    }
}