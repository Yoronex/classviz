export class Neo4jClient {
    async getAllDomains() {
        const response = await fetch('http://localhost:3000/api/graph/domains');
        const json = await response.json();
        console.log(json);
        return json;
    }

    async getDomainModules(id, graphDepth, onlyInternalRelations = false, onlyExternalRelations = false) {
        const response = await fetch('http://localhost:3000/api/graph/node', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id,
                graphDepth,
                onlyInternalRelations,
                onlyExternalRelations,
            })
        });
        const json = await response.json();
        console.log(json);
        return json;
    }
}