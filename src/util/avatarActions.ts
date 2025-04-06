import {Contact} from "../parse/contact";

const resizeAndCropImage = (img: HTMLImageElement, outputSize: number): HTMLCanvasElement => {
	const canvas = document.createElement('canvas');
	canvas.width = outputSize;
	canvas.height = outputSize;

	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas context not available');

	const { naturalWidth: srcW, naturalHeight: srcH } = img;

	const scale = Math.max(outputSize / srcW, outputSize / srcH);
	const scaledW = srcW * scale;
	const scaledH = srcH * scale;

	const dx = (outputSize - scaledW) / 2;
	const dy = (outputSize - scaledH) / 2;

	ctx.drawImage(img, dx, dy, scaledW, scaledH);
	return canvas;
};


const base64EncodeImage = (canvas: HTMLCanvasElement, quality: number = 1): string => {
	return canvas.toDataURL('image/jpeg', quality);
};

const getImage = (fileOrUrl: File | string): Promise<HTMLImageElement> => {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';

		img.onload = () => resolve(img);
		img.onerror = reject;

		if (typeof fileOrUrl === 'string') {
			img.src = fileOrUrl;
		} else {
			const reader = new FileReader();
			reader.onload = () => {
				img.src = reader.result as string;
			};
			reader.onerror = reject;
			reader.readAsDataURL(fileOrUrl);
		}
	});
};

const setBase64Avatar = async (
	fileOrUrl: File | string,
): Promise<string> => {
	const outputSize = 120;
	const quality = 1;
	const img = await getImage(fileOrUrl);
	const canvas = resizeAndCropImage(img, outputSize);
	return base64EncodeImage(canvas, quality);
};

export const processAvatar = async (contact: Contact) => {
	console.log(contact.data['PHOTO']);
}

export const convertToLatestVCFPhotoFormat = (line:string) => {
	const url = line.startsWith('PHOTO;') ? line.slice(6) : line;
	const match = url.match(/^ENCODING=BASE64;(.*?):/);
		if (match) {
		const mimeType = match[1].toLowerCase(); // e.g., "jpeg"
		const base64Data = url.split(':').slice(1).join(':');
		return `data:image/${mimeType};base64,${base64Data}`;
	}
	return url;
}
