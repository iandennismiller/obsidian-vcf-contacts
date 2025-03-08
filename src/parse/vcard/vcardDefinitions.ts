export enum VCardSupportedKey {
	VERSION = "vCard Version",
	N = "Name",
	FN = "Full Name",
	NICKNAME = "Nickname",
	ADR = "Address",
	ADR_LABEL = "Address Label",
	AGENT = "Agent (Representative)",
	ANNIVERSARY = "Anniversary Date",
	BDAY = "Birthday",
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
	URL = "Website URL"
}

export const VCardSupportedType = {
	TEL: ["text", "voice", "fax", "cell", "video", "pager", "textphone"],
	ADR: [
		"home", "work", "billing", "delivery", "postal",
		"dom", "intl", "parcel", "pref"
	],
	EMAIL: ["internet", "x400", "pref"],
	LABEL: [
		"home", "work", "billing", "delivery", "postal",
		"dom", "intl", "parcel", "pref"
	],
	PHOTO: ["image/jpeg", "image/png", "image/gif"],
	GEO: ["uri", "text"],
	TZ: ["utc-offset", "text", "uri"]
} as const;

export const VCardStructuredFields = {
	N: ["FN", "GN", "MN", "PREFIX", "SUFFIX"], // Name components
	ADR: ["PO", "EXT", "STREET", "LOCALITY", "REGION", "POSTAL", "COUNTRY"] // Address components
} as const;

export enum VCardStructuredSupportedKey {
	// Name (N) Fields
	"N.FN" = "Family Name",
	"N.GN" = "Given Name",
	"N.MN" = "Middle Name(s)",
	"N.PREFIX" = "Honorific Prefix",
	"N.SUFFIX" = "Honorific Suffix",

	// Address (ADR) Fields
	"ADR.PO" = "Post Office Box",
	"ADR.EXT" = "Extended Address",
	"ADR.STREET" = "Street Address",
	"ADR.LOCALITY" = "City / Locality",
	"ADR.REGION" = "State / Region",
	"ADR.POSTAL" = "ZIP / Postal Code",
	"ADR.COUNTRY" = "Country"
}

