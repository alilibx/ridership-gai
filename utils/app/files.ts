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

export const extractContentFromJsonFile = (filePath: string, type: string, language: string) => {
    // If file doesnt   exist return an empty array
    if (!fs.existsSync(filePath)) {
        return [];
    }
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonArray = JSON.parse(fileContent).allservices;
    const ignoredFieldsNames = ['channels','id','parent_id','transaction_id','unique_id','related_documents','apply_now_link','most_popular','service_classification','disclaimer','updated_at','service_packages']
    const contentArray = jsonArray.map((item: any) => {
        const fields = Object.keys(item);
        // If the field is 'channels' then join the array of channel name and desciptions in to one string 
        var content = fields
            .filter((field) => !ignoredFieldsNames.includes(field))
            .map((field) => field + ': ' + item[field])
            .join(' ');

        // if the field is 'channels' then join the array of channel name and desciptions in to one string
        const channels = fields
            .filter((field) => field === 'channels')
            .map((field) => item[field].map((channel: any) => channel.title + ' ' + channel.description).join(' '))
            .join(' ');

        // Add the channels string to the content string
        content.concat(channels);

        // Remove all html tags from the content string
        content = removeHtmlTags(content);

        return { content, metadata: { unique_id: item.unique_id, name: item.name, type: type, language: language } };
    });
    return contentArray;
}

// Create a function to take string and removed all html tags including urls and return a string
export const removeHtmlTags = (str: string) => {
    const regex = /(<([^>]+)>)/ig;
    return str.replace(regex, '');
}
