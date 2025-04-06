import { randomUUID } from "crypto";
import * as React from "react";
import { Contact } from "src/parse/contact";
import { Sort } from "src/util/constants";
import { ContactView } from "./ContactView";
import myScrollTo from "src/util/myScrollTo";
import {TFile} from "obsidian";


type ContactsListProps = {
	contacts: Contact[];
	sort: Sort;
	processAvatar: (contact: Contact) => void;
	exportVCF: (contactFile: TFile) => void;
};

const getNextBirthday = (birthdayStr: string): Date => {
	const today = new Date();
	const currentYear = today.getFullYear();
	// Extract month and day from the birthday string.
	const [ , monthStr, dayStr ] = birthdayStr.split('-');
	const month = Number(monthStr); // 1-12
	const day = Number(dayStr);     // 1-31

	// Create a date for the birthday this year.
	let nextBirthday = new Date(currentYear, month - 1, day);

	// If this year's birthday has already passed, use the birthday in the next year.
	if (nextBirthday < today) {
		nextBirthday = new Date(currentYear + 1, month - 1, day);
	}
	return nextBirthday;
};

export const ContactsListView = (props: ContactsListProps) => {
	const [processedContacts, setProcessedContacts] = React.useState<Contact[]>(
		[]
	);

	const contacts = props.contacts;
	const sort = props.sort;

	React.useEffect(() => {
		const sortedContacts = [...contacts].sort((a, b) => {
			switch (sort) {
				case Sort.NAME:
					return (a.data['N.GN'] + a.data['N.FN']).localeCompare(b.data['N.GN'] + b.data['N.FN']);
				case Sort.BIRTHDAY: {
					const aBday = a.data['BDAY'];
					const bBday = b.data['BDAY'];

					// Push contacts without a birthday to the bottom.
					if (aBday && !bBday) return -1;
					if (!aBday && bBday) return 1;
					if (!aBday && !bBday) return 0;

					// Calculate the next birthday date for each contact.
					const nextA = getNextBirthday(aBday);
					const nextB = getNextBirthday(bBday);

					// Sort by the computed next birthday (earlier dates come first).
					return nextA.getTime() - nextB.getTime();
				}
				case Sort.ORG: {
					const orgA = a.data['ORG'];
					const orgB = b.data['ORG'];

					if (orgA && !orgB) return -1;
					if (!orgA && orgB) return 1;

					if (!orgA && !orgB) {
						const nameA = (a.data['N.GN'] + a.data['N.FN']) || "";
						const nameB = (b.data['N.GN'] + b.data['N.FN']) || "";
						return nameA.localeCompare(nameB);
					}

					const orgCompare = orgA.localeCompare(orgB);
					if (orgCompare !== 0) return orgCompare;
					const nameA = (a.data['N.GN'] + a.data['N.FN']) || "";
					const nameB = (b.data['N.GN'] + b.data['N.FN']) || "";
					return nameA.localeCompare(nameB);
				}
				default:
					return 0;
			}
		});
		setProcessedContacts(sortedContacts);
	}, [contacts, sort]);


	React.useEffect(() => {
		myScrollTo.scrollToTop()
	}, [sort]);

	return (
		<>
			{processedContacts.map((contact) => {
				return <ContactView contact={contact} key={randomUUID()} exportVCF={props.exportVCF} processAvatar={props.processAvatar} />;
			})}
		</>
	);
};
