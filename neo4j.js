export class Neo4jClient {
    driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'QAd31C6wU5jAevy1'));

    graphDepth = 1;
    selectedNodeId;

    async getAllDomains() {
        this.selectedNodeId = undefined;
        const session = this.driver.session();
        const result = await session.run(`MATCH (d: Domain) return d`);
        console.info(result);
        return this.formatToLPG(result.records);
    }

    async getDomainModules(id = undefined, onlyInternalRelations = false, onlyExternalRelations = false) {
        if (id) this.selectedNodeId = id;
        const session = this.driver.session();
        let query = `
            MATCH (selectedNode WHERE elementId(selectedNode) = '${this.selectedNodeId}')-[r1:CONTAINS*0..5]->(moduleOrLayer) // Get all modules that belong to the selected node
            OPTIONAL MATCH (moduleOrLayer)-[r2*1..${this.graphDepth}]->(dependency:Module)                                           // Get the dependencies of the modules with given depth
            MATCH (selectedNode)<-[r3:CONTAINS*0..5]-(selectedParent)                                                  // Find all the parents of the selected node (up to the domain)
            MATCH (selectedNode)<-[:CONTAINS*0..5]-(selectedDomain:Domain)                                             // Get the domain of the selected node
            MATCH (dependency)<-[r4:CONTAINS*0..5]-(parent)                                                            // Get the layers, application and domain of all dependencies
            WHERE true `;
        if (onlyInternalRelations) {
            query += 'AND (selectedDomain:Domain)-[:CONTAINS*]->(dependency) '; // Dependency should be in the same domain
        }
        if (onlyExternalRelations) {
            // TODO: Fix exclusion of all non-module nodes between the selected node and modules (like (sub)layers)
            query += 'AND NOT (selectedDomain:Domain)-[:CONTAINS*]->(dependency) '; // Dependency should not be in the same domain
        }
        query += 'RETURN DISTINCT selectedNode, r1, r2, r3, r4, moduleOrLayer, dependency, selectedParent, parent';

        const result = await session.run(query);
        console.info(result);
        return this.formatToLPG(result.records);
    }
    //
    // AND (selectedDomain)-[:CONTAINS*]->(dependency)

    formatToLPG(records) {
        const nodes = records
            .map((r) => r._fields
                .filter((field) => !Array.isArray(field))
                .map((field) => ({
                    data: {
                        id: field.elementId,
                        properties: {
                            simpleName: field.properties.simpleName,
                            kind: 'node',
                            traces: [],
                            color: field.properties.color,
                            depth: field.properties.depth,
                            selected: field.elementId === this.selectedNodeId ? 'true' : 'false',
                        },
                        labels: field.labels,
                    },
                }))
            )
            .flat()
            .filter((node, index, all) => all.findIndex((n2) => n2.data.id === node.data.id) === index);

        const edges = records
            .map((r) => r._fields
                .filter((field) => Array.isArray(field))
                .map((relationships) => {
                    return relationships.map((r) => ({ data: {
                        id: r.elementId,
                        source: r.startNodeElementId,
                        target: r.endNodeElementId,
                        label: r.type.toLowerCase(),
                        properties: {
                            weight: 1,
                            traces: [],
                        }
                    }}))
                }))
            .flat()
            .flat()
            .filter((e1, index, edges) => index === edges
                .findIndex((e2) => e1.data.id === e2.data.id))

        return {
            nodes,
            edges,
        };
    }
}