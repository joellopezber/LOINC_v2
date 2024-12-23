// Search Component
class SearchComponent {
    constructor() {
        console.log('Inicializando SearchComponent');
        this.searchInput = document.querySelector('.search-input');
        this.searchButton = document.querySelector('.search-button');
        this.searchForm = document.querySelector('.search-box');

        if (!this.searchInput || !this.searchButton || !this.searchForm) {
            console.error('No se encontraron los elementos de búsqueda');
            return;
        }

        this.initializeEvents();
    }

    initializeEvents() {
        console.log('Inicializando eventos de búsqueda');
        
        this.searchButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Click en botón de búsqueda');
            this.performSearch();
        });

        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performSearch();
            }
        });

        // Escuchar resultados de búsqueda
        if (window.socket) {
            window.socket.on('search.results', (data) => {
                console.log('Resultados de búsqueda recibidos:', data);
                this.handleSearchResults(data);
            });
        }
    }

    async performSearch() {
        const searchTerm = this.searchInput.value.trim();
        if (!searchTerm) {
            console.log('Término de búsqueda vacío');
            return;
        }

        console.log('Realizando búsqueda:', searchTerm);
        
        try {
            // Obtener configuración actual usando storageService
            const searchConfig = await window.storageService.getSearchConfig();
            
            // Enviar búsqueda por WebSocket
            window.socket.emit('search.perform', {
                term: searchTerm,
                config: searchConfig,
                request_id: `search_${Date.now()}`
            });
            
        } catch (error) {
            console.error('Error realizando la búsqueda:', error);
        }
    }

    handleSearchResults(data) {
        console.log('Procesando resultados:', data);
        // Implementar lógica de mostrar resultados
    }
}

export default SearchComponent; 