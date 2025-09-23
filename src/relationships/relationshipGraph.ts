import Graph from 'graphology';
import { TFile } from 'obsidian';

export interface RelationshipEdge {
	kind: string; // The relationship type (friend, parent, child, etc.)
	genderless: string; // The genderless form of the relationship (e.g., "auncle" for aunt/uncle)
}

export interface ContactNode {
	uid?: string; // vCard UID
	fullName: string; // Display name for the contact
	file?: TFile; // Reference to the Obsidian file
}

export class RelationshipGraph {
	private graph: Graph;

	constructor() {
		this.graph = new Graph({ type: 'directed', multi: true });
	}

	/**
	 * Add a contact node to the graph
	 */
	addContact(nodeId: string, contact: ContactNode): void {
		if (!this.graph.hasNode(nodeId)) {
			this.graph.addNode(nodeId, contact);
		} else {
			// Update existing node
			this.graph.mergeNodeAttributes(nodeId, contact);
		}
	}

	/**
	 * Remove a contact node from the graph
	 */
	removeContact(nodeId: string): void {
		if (this.graph.hasNode(nodeId)) {
			this.graph.dropNode(nodeId);
		}
	}

	/**
	 * Add a relationship edge between two contacts
	 */
	addRelationship(fromNodeId: string, toNodeId: string, relationship: RelationshipEdge): void {
		// Ensure both nodes exist
		if (!this.graph.hasNode(fromNodeId) || !this.graph.hasNode(toNodeId)) {
			throw new Error(`Cannot add relationship: one or both nodes do not exist`);
		}

		// Create a unique edge key based on the relationship kind
		const edgeKey = `${fromNodeId}-${toNodeId}-${relationship.kind}`;
		
		if (!this.graph.hasEdge(edgeKey)) {
			this.graph.addEdgeWithKey(edgeKey, fromNodeId, toNodeId, relationship);
		} else {
			// Update existing edge
			this.graph.mergeEdgeAttributes(edgeKey, relationship);
		}
	}

	/**
	 * Remove a specific relationship edge
	 */
	removeRelationship(fromNodeId: string, toNodeId: string, relationshipKind: string): void {
		const edgeKey = `${fromNodeId}-${toNodeId}-${relationshipKind}`;
		if (this.graph.hasEdge(edgeKey)) {
			this.graph.dropEdge(edgeKey);
		}
	}

	/**
	 * Get all relationships for a contact
	 */
	getRelationshipsForContact(nodeId: string): Array<{
		target: string;
		targetNode: ContactNode;
		relationship: RelationshipEdge;
	}> {
		if (!this.graph.hasNode(nodeId)) {
			return [];
		}

		const relationships: Array<{
			target: string;
			targetNode: ContactNode;
			relationship: RelationshipEdge;
		}> = [];

		this.graph.forEachOutboundEdge(nodeId, (edgeKey, attributes, source, target) => {
			const targetNode = this.graph.getNodeAttributes(target) as ContactNode;
			relationships.push({
				target,
				targetNode,
				relationship: attributes as RelationshipEdge
			});
		});

		return relationships;
	}

	/**
	 * Get all contacts in the graph
	 */
	getAllContacts(): Map<string, ContactNode> {
		const contacts = new Map<string, ContactNode>();
		this.graph.forEachNode((nodeId, attributes) => {
			contacts.set(nodeId, attributes as ContactNode);
		});
		return contacts;
	}

	/**
	 * Find a contact by UID or fullName
	 */
	findContact(identifier: string): string | null {
		// First try to find by UID
		let foundNodeId: string | null = null;
		
		this.graph.forEachNode((nodeId, attributes) => {
			const contact = attributes as ContactNode;
			if (contact.uid === identifier) {
				foundNodeId = nodeId;
			}
		});
		
		if (foundNodeId) {
			return foundNodeId;
		}

		// Then try to find by fullName
		this.graph.forEachNode((nodeId, attributes) => {
			const contact = attributes as ContactNode;
			if (contact.fullName === identifier) {
				foundNodeId = nodeId;
			}
		});

		return foundNodeId;
	}

	/**
	 * Check if a contact exists in the graph
	 */
	hasContact(nodeId: string): boolean {
		return this.graph.hasNode(nodeId);
	}

	/**
	 * Clear all data from the graph
	 */
	clear(): void {
		this.graph.clear();
	}

	/**
	 * Get the underlying graph for advanced operations
	 */
	getGraph(): Graph {
		return this.graph;
	}
}