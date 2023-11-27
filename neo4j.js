export class Neo4jClient {
    driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'QAd31C6wU5jAevy1'));

    async getAllDomains() {
        const session = this.driver.session();
        const result = await session.run(`MATCH (d: Domain) return d`);
        console.info(result);
        return this.formatToLPG(result.records);
    }

    formatToLPG(records) {
        return {
            nodes: records.map((r) => {
                const {labels, properties} = r._fields[0];
                return {
                    data: {
                        id: properties.id,
                        properties: {
                            simpleName: properties.name,
                            kind: 'node',
                            traces: [],
                        },
                        labels,
                    },
                };
            }),
            edges: [],
        };
    }
}