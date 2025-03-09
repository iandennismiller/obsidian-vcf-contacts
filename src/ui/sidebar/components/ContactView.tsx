import * as React from "react";
import { useApp } from "src/context/hooks";
import { openFile } from "src/file/file";
import { Contact } from "src/parse/contact";
import { daysUntilBirthday, diffDateToday } from "src/util/dates";
import {VCardSDisplayNames} from "src/parse/vcard/vcardDefinitions";
import {parseVCardKey} from "src/parse/vcard/vcardParse";

type ContactProps = {
	contact: Contact;
};

type SplitDataAccumulator = {
	renderIndividual: Record<string, any>;
	renderAsBlock: Record<string, any>;
};

export const ContactView = (props: ContactProps) => {
	const { workspace } = useApp();
	const contact = props.contact;

	const { renderIndividual, renderAsBlock } = Object.entries(contact.data).reduce<SplitDataAccumulator>(
		(acc, [rawKey, value]) => {
			const keyparts = parseVCardKey(rawKey);
			if (['N', 'ADR'].includes(keyparts.base)) {
				acc.renderAsBlock[rawKey] = value;
			} else {
				acc.renderIndividual[rawKey] = value;
			}
			return acc;
		},
		{
			renderIndividual: {},
			renderAsBlock: {}
		}
	);

	const uniqueBlockPrefixes = [
		...new Set(Object.keys(renderAsBlock).map(key => key.split('.')[0]))
	].sort((a, b) => a.length - b.length);

	const renderField = (rawKey: string, value: any) => {
		const keyParts = parseVCardKey(rawKey);

		const lookupKey = keyParts.subkey ? `${keyParts.base}.${keyParts.subkey}` : keyParts.base;
		const displayName = VCardSDisplayNames[`${lookupKey}`];
		if (!displayName) return null;
		return (
			<div key={rawKey}>
				<strong>
					{displayName}
					{keyParts.type ? ` (${keyParts.type}${keyParts.index ? ` #${keyParts.index}` : ''})` : ''}:
				</strong>{' '}
				{value}
			</div>
		);
	};

	const renderBlock = (prefix: string, values: any) => {
		const keyparts = parseVCardKey(prefix);

		switch (keyparts.base) {
			case "N": return (
				<div style={{ paddingBottom: '12px', paddingTop: '4px', fontSize: '24px' }}>
					{[
						values[`${prefix}.PREFIX`],
						values[`${prefix}.GN`],
						values[`${prefix}.MN`],
						values[`${prefix}.FN`],
						values[`${prefix}.SUFFIX`]
					]
						.filter(part => part && part.trim())
						.join(' ')}
				</div>
			)
			case "ADR": return (
				<div>
					<div style={{ paddingBottom: '8px'}}>
						<div>
							<strong>
								Adress {keyparts.type ? ` (${keyparts.type})` : ''}:
							</strong>
						</div>
						{(values[`${prefix}.PO`] || values[`${prefix}.EXT`]) && (
							<div>
								{[
									values[`${prefix}.PO`],
									values[`${prefix}.EXT`]
								]
									.filter(part => part && part.trim())
									.join(' ')}
							</div>
						)}
						{(values[`${prefix}.STREET`] || values[`${prefix}.LOCALITY`]) && (
							<div>
								{[
									values[`${prefix}.STREET`]
								]
									.filter(part => part && part.trim())
									.join(' ')}
							</div>
						)}
						{(values[`${prefix}.POSTAL`] || values[`${prefix}.LOCALITY`] || values[`${prefix}.REGION`] || values[`${prefix}.COUNTRY`]) && (
							<div>
								{[
									values[`${prefix}.POSTAL`],
									values[`${prefix}.LOCALITY`],
									values[`${prefix}.REGION`],
									values[`${prefix}.COUNTRY`]
								]
									.filter(part => part && part.trim())
									.join(' ')}
							</div>
						)}
					</div>
				</div>
			)
			default: return;
		}


	};

	return (
		<div
			style={{ padding: '8px' }}
			className="contact-card"
			onClick={() => openFile(contact.file, workspace)}
		>
			<div className="content">
				{uniqueBlockPrefixes.map((prefix) => renderBlock(prefix, renderAsBlock))}
				{Object.entries(renderIndividual).map(([key, value]) => renderField(key, value))}
			</div>
		</div>
	);
};
