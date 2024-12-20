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
        
        // Solo manejar el click del botón de búsqueda
        this.searchButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Click en botón de búsqueda');
            this.performSearch();
        });

        // Manejar la tecla Enter en el input
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performSearch();
            }
        });
    }

    async performSearch() {
        const searchTerm = this.searchInput.value.trim();
        if (!searchTerm) {
            console.log('Término de búsqueda vacío');
            return;
        }

        console.log('Realizando búsqueda:', searchTerm);
        const config = window.storage.getConfig();
        
        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    term: searchTerm,
                    config: config.search
                })
            });

            if (!response.ok) {
                throw new Error('Error en la búsqueda');
            }

            const results = await response.json();
            console.log('Resultados:', results);
            // Aquí iría la lógica para mostrar los resultados
        } catch (error) {
            console.error('Error realizando la búsqueda:', error);
            // Aquí iría la lógica para mostrar el error
        }
    }
}

export default SearchComponent; 