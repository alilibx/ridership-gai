



export const updateProgressBar = (currentCount: number, totalCount: number)  =>{
    const progressBarLength = 40;
    const progressBarFillLength = Math.round((currentCount / totalCount) * progressBarLength);
    const progressBar = "[" + "=".repeat(progressBarFillLength) + " ".repeat(progressBarLength - progressBarFillLength) + "]";

    process.stdout.write(`Processing Documents: ${currentCount}/${totalCount} ${progressBar}\r`);
}

export const updateStatusText = (text: string) =>{
    console.log(text);
}


