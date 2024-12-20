// API Client Configuration
const API_CONFIG = {
    BASE_URL: '',  // Base URL se determina automáticamente
    ENDPOINTS: {
        ANALYZE: '/api/analyze',
        SEARCH: '/api/search',
        FILTER: '/api/filter',
        ELASTIC_SEARCH: '/api/elastic-search',
        RECREATE_INDEX: '/api/elastic/recreate-index'
    }
};

// API Client Class
class ApiClient {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
    }

    // Analyze terms using AI
    async analyzeTerms(term) {
        try {
            console.log('🔄 Iniciando análisis del término:', term);
            const response = await this.post(API_CONFIG.ENDPOINTS.ANALYZE, { term });
            console.log('✨ Análisis ontología procesado:', response);
            return response;
        } catch (error) {
            console.error('❌ Error en análisis:', error);
            throw error;
        }
    }

    // Search terms
    async search(term, config = {}) {
        try {
            const response = await this.post(API_CONFIG.ENDPOINTS.SEARCH, {
                term,
                ...config
            });
            
            if (response.processed_terms) {
                this.saveToHistory(response.processed_terms);
            }

            return response.elastic_results || response;
        } catch (error) {
            console.error('Error en búsqueda:', error);
            throw error;
        }
    }

    // Elastic search
    async elasticSearch(term, searchType = 'all') {
        try {
            console.log('🔄 Iniciando búsqueda en Elasticsearch:', term);
            const response = await this.post(API_CONFIG.ENDPOINTS.ELASTIC_SEARCH, {
                term,
                search_type: searchType
            });
            console.log('✨ Búsqueda Elastic completada');
            return response;
        } catch (error) {
            console.error('Error en búsqueda Elastic:', error);
            throw error;
        }
    }

    // Filter results
    async filterResults(term) {
        try {
            console.log('🔄 Iniciando filtrado de resultados:', term);
            const response = await this.post(API_CONFIG.ENDPOINTS.FILTER, { term });
            console.log('✨ Filtrado completado');
            return response;
        } catch (error) {
            console.error('❌ Error en filtrado:', error);
            throw error;
        }
    }

    // Utility method for POST requests
    async post(endpoint, data) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    // Save to search history
    saveToHistory(processedTerms) {
        const event = new CustomEvent('searchHistoryUpdated', {
            detail: { processedTerms }
        });
        window.dispatchEvent(event);
    }
}

// Export as singleton
export const apiClient = new ApiClient(); 