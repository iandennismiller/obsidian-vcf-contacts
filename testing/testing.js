const fs = require('fs');

function parseVCard(vCardData) {
	const normalizedData = vCardData.replace(/\r\n?/g, '\n');
	const lines = normalizedData.split('\n');
	const unfoldedLines = [];
	let currentLine = '';

	for (const line of lines) {
		if (/^\s/.test(line)) {
			// Continuation of previous line (line folding)
			currentLine += line.trimStart();
		} else {
			if (currentLine) unfoldedLines.push(currentLine);
			currentLine = line;
		}
	}
	if (currentLine) unfoldedLines.push(currentLine);

	// Parse unfolded lines
	const vCard = [];
	for (const line of unfoldedLines) {
		const [key, ...valueParts] = line.split(':');
		const value = valueParts.join(':').trim();
		const [property, ...paramParts] = key.split(';');
		const params = paramParts.reduce((acc, part) => {
			const [paramKey, paramValue] = part.split('=');
			acc[paramKey.toLowerCase()] = paramValue ? paramValue.split(',') : [];
			return acc;
		}, {});

		if (property.toLowerCase() === 'adr' || property.toLowerCase() === 'n') {
			const components = value.split(';');
			vCard.push([property.toLowerCase(), params, 'text', components]);
		} else {
			vCard.push([property.toLowerCase(), params, 'text', value]);
		}
	}

	return(vCard)
}

function vCardToMarkdown(vCardArray) {
	const headers = ['vCard Key', 'Parameters', 'Type', 'Value'];

	// Format rows
	const rows = vCardArray.map(([key, params, type, value]) => {
		// Convert parameters to a readable JSON string
		const formattedParams = JSON.stringify(params, null, 0);
		// Convert value to string (handle arrays)
		const formattedValue = Array.isArray(value) ? value.join('; ') : value;

		return `| ${key} | ${formattedParams} | ${type} | ${formattedValue} |`;
	});

	// Create Markdown table
	const table = [
		`| ${headers.join(' | ')} |`,
		`| ${headers.map(() => '---').join(' | ')} |`,
		...rows
	].join('\n');

	return table;
}

let vCardData = fs.readFileSync('/home/roland/Downloads/contacts.vcf', 'utf8');
const vCardSections = vCardData.split(/BEGIN:VCARD\s*[\n\r]+|END:VCARD\s*[\n\r]+/).filter(section => section.trim());
vCardSections.forEach((section) => {
	const parsedVCard = parseVCard(section);
	const markdownTable = vCardToMarkdown(parsedVCard);
	console.log(markdownTable);
})





