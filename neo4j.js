export class Neo4jClient {
    async getAllDomains() {
        const response = await fetch('http://localhost:3000/api/graph/domains');
        const json = await response.json();
        console.log(json);
        return json;
    }

    async getDomainModules(id, layerDepth, dependencyDepth, onlyInternalRelations = false, onlyExternalRelations = false, showDependencies = true, showDependents = false, dependencyRange, dependentRange) {
        const response = await fetch('http://localhost:3000/api/graph/node', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id,
                layerDepth,
                dependencyDepth,
                onlyInternalRelations,
                onlyExternalRelations,
                showDependencies,
                showDependents,
                dependencyRange,
                dependentRange
            })
        });
        const json = await response.json();
        console.log(json);
        return json;
    }
}