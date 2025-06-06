export const photoLineFromV3toV4 = (line:string) => {
  const url = line.startsWith('PHOTO;') ? line.slice(6) : line;
  const match = url.match(/^ENCODING=BASE64;(.*?):/);
  if (match) {
    const mimeType = match[1].toLowerCase(); // e.g., "jpeg"
    const base64Data = url.split(':').slice(1).join(':');
    return `data:image/${mimeType};base64,${base64Data}`;
  }
  return url;
}
