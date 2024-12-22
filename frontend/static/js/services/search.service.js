class SearchService {
    constructor() {
        this.API_ENDPOINT = '/api/ontology/analyze';
        this.searchConfig = this.loadSearchConfig();
    }

    loadSearchConfig() {
        const defaultConfig = {
            ontologyMode: 'multi_match',
            dbMode: 'elastic',
            openai: {
                useOriginalTerm: true,
                useEnglishTerm: true,
                useRelatedTerms: true,
                useTestTypes: true,
                useLoincCodes: true,
                useKeywords: true
            }
        };

        const savedConfig = localStorage.getItem('searchConfig');
        return savedConfig ? JSON.parse(savedConfig) : defaultConfig;
    }

    async search(term) {
        console.log(`[Search] Buscando término: ${term}`);
        
        try {
            const response = await fetch(this.API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    term,
                    config: this.searchConfig
                })
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log(`[Search] Resultados obtenidos:`, data);
            return {
                success: true,
                data
            };

        } catch (error) {
            console.error(`[Search] Error en búsqueda:`, error);
            return {
                success: false,
                message: `Error en búsqueda: ${error.message}`
            };
        }
    }

    updateConfig(newConfig) {
        this.searchConfig = {
            ...this.searchConfig,
            ...newConfig
        };
        localStorage.setItem('searchConfig', JSON.stringify(this.searchConfig));
    }
}

export const searchService = new SearchService(); 