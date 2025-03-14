export enum VCardSupportedKey {
	VERSION = "vCard Version",
	N = "Name",
	FN = "Full Name",
	NICKNAME = "Nickname",
	ADR = "Address",
	ADR_LABEL = "Address Label",
	AGENT = "Agent (Representative)",
	ANNIVERSARY = "Anniversary Date",
	BDAY = "Birthday Date",
	CATEGORIES = "Categories (Tags)",
	CLASS = "Classification (Privacy Level)",
	EMAIL = "Email Address",
	GENDER = "Gender",
	GEO = "Geolocation (Latitude/Longitude)",
	LANG = "Language Spoken",
	MEMBER = "Group Member",
	NAME = "Name Identifier",
	NOTE = "Notes",
	ORG = "Organization Name",
	PHOTO = "Profile Photo",
	REV = "Last Updated Timestamp",
	ROLE = "Job Role or Title",
	SOURCE = "vCard Source URL",
	TEL = "Telephone Number",
	TITLE = "Job Title",
	TZ = "Time Zone",
	UID = "Unique Identifier",
	URL = "Website URL",
  SOCIALPROFILE = "Social Profile"
}

export const VCardStructuredFields = {
	N: ["PREFIX", "GN", "MN", "FN", "SUFFIX"],
	ADR: ["PO", "EXT", "STREET", "LOCALITY", "REGION", "POSTAL", "COUNTRY"]
} as const;

export interface VCardForObsidianRecord {
	[key: string]: string,
}
