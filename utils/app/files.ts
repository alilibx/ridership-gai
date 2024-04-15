import fs from 'fs';

export const humanFileSize = (size: number): string => {
    const units = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    let i = 0;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(0)} ${units[i]}`;
}

export const extractContentFromJsonFile = (filePath: string) => {
    // If file doesnt   exist return an empty array
    if (!fs.existsSync(filePath)) {
        return [];
    }
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