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

    async getDomainModules(id = undefined) {
        if (id) this.selectedNodeId = id;
        const session = this.driver.session();
        const result = await session.run(`MATCH (d)-[r*0..${this.graphDepth}]->(a) WHERE elementId(d) = '${this.selectedNodeId}' RETURN d, r, a UNION ALL MATCH (d)<-[r:CONTAINS*]-(a) WHERE elementId(d) = '${this.selectedNodeId}' RETURN a, r, d`);
        console.info(result);
        return this.formatToLPG(result.records);
    }

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