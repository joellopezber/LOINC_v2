// API Client Configuration
const API_CONFIG = {
    BASE_URL: '',  // Base URL se determina automáticamente
    ENDPOINTS: {
        SEARCH: '/api/search'
    }
};

// API Client Class
class ApiClient {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
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