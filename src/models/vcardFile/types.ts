/**
 * @fileoverview VCard type definitions and enums
 * 
 * This module contains all type definitions, interfaces, enums, and constants
 * used throughout the VCard processing system. It provides a centralized
 * location for VCard-related types to ensure consistency and prevent
 * circular dependencies.
 * 
 * @module VCardTypes
 */

/**
 * Enumeration of supported VCard field keys with human-readable descriptions.
 * Maps VCard field names to their user-friendly descriptions.
 * 
 * @enum {string}
 */
export enum VCardSupportedKey {
	/** VCard format version */
	VERSION = "vCard Version",
	/** Structured name components */
	N = "Name",
	/** Formatted full name */
	FN = "Full Name",
	/** Informal name or nickname */
	NICKNAME = "Nickname",
	/** Structured postal address */
	ADR = "Address",
	/** Address label for display */
	ADR_LABEL = "Address Label",
	/** Contact's agent or representative */
	AGENT = "Agent (Representative)",
	/** Anniversary date */
	ANNIVERSARY = "Anniversary Date",
	/** Birth date */
	BDAY = "Birthday Date",
	/** Categories or tags for organization */
	CATEGORIES = "Categories (Tags)",
	/** Security classification level */
	CLASS = "Classification (Privacy Level)",
	/** Email address */
	EMAIL = "Email Address",
	/** Gender identity */
	GENDER = "Gender",
	/** Geographic coordinates */
	GEO = "Geolocation (Latitude/Longitude)",
	/** Type of contact entity */
	KIND = "Contact Type",
	/** Spoken languages */
	LANG = "Language Spoken",
	/** Group membership */
	MEMBER = "Group Member",
	/** Name source identifier */
	NAME = "Name Identifier",
	/** Free-form notes */
	NOTE = "Notes",
	/** Organization name */
	ORG = "Organization Name",
	/** Profile photo */
	PHOTO = "Profile Photo",
	/** Last revision timestamp */
	REV = "Last Updated Timestamp",
	/** Job role or position */
	ROLE = "Job Role or Title",
	/** Source URL for this vCard */
	SOURCE = "vCard Source URL",
	/** Telephone number */
	TEL = "Telephone Number",
	/** Job title */
	TITLE = "Job Title",
	/** Time zone */
	TZ = "Time Zone",
	/** Unique identifier */
	UID = "Unique Identifier",
	/** Website URL */
	URL = "Website URL",
	/** Social media profile */
    SOCIALPROFILE = "Social Profile",
	/** Related contact reference */
    RELATED = "Related Contact"
}

/**
 * VCard data record optimized for Obsidian integration.
 * Contains flattened key-value pairs extracted from VCard properties.
 * 
 * @interface VCardForObsidianRecord
 */
export interface VCardForObsidianRecord {
	/** Dynamic key-value pairs representing VCard properties */
	[key: string]: string,
}

/**
 * Error information for VCard processing failures.
 * Used to collect and report errors during batch operations.
 * 
 * @interface VCardToStringError
 */
export interface VCardToStringError {
    /** Error status indicator */
    status: string;
    /** Filename where error occurred */
    file: string;
    /** Detailed error message */
    message: string;
}

/**
 * Response structure for VCard generation operations.
 * Contains both successful results and any errors encountered.
 * 
 * @interface VCardToStringReply
 */
export interface VCardToStringReply {
    /** Generated VCard content as string */
    vcards: string;
    /** Array of errors encountered during processing */
    errors: VCardToStringError[];
}

/**
 * VCard KIND property values defining contact entity types.
 * Based on RFC 6350 specification.
 * 
 * @typedef {string} VCardKind
 */
export type VCardKind = "individual" | "org" | "group" | "location";

/**
 * Structured field definitions for complex VCard properties.
 * Maps field names to their component sub-fields in order.
 * 
 * @constant {Object} StructuredFields
 */
export const StructuredFields = {
    /** Name structure: Family, Given, Middle, Prefix, Suffix */
    N: ["FN", "GN", "MN", "PREFIX", "SUFFIX"],
    /** Address structure: PO Box, Extended, Street, Locality, Region, Postal, Country */
    ADR: ["PO", "EXT", "STREET", "LOCALITY", "REGION", "POSTAL", "COUNTRY"]
} as const;

/**
 * Standard VCard KIND values with consistent naming.
 * Provides canonical strings for entity type classification.
 * 
 * @constant {Object} VCardKinds
 */
export const VCardKinds = {
    /** Individual person */
    Individual: "individual",
    /** Organization */
    Organisation: "org", 
    /** Group of contacts */
    Group: "group",
    /** Physical location */
    Location: "location",
} as const;