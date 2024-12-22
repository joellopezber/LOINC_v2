import { searchService } from '../services/search.service.js';

class SearchBox extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    max-width: 600px;
                    margin: 0 auto;
                }

                .search-container {
                    position: relative;
                    width: 100%;
                }

                .search-input {
                    width: 100%;
                    padding: 12px 20px;
                    font-size: 16px;
                    border: 2px solid #ddd;
                    border-radius: 25px;
                    outline: none;
                    transition: all 0.3s ease;
                }

                .search-input:focus {
                    border-color: #2196F3;
                    box-shadow: 0 0 8px rgba(33, 150, 243, 0.3);
                }

                .search-button {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: #2196F3;
                    color: white;
                    border: none;
                    border-radius: 20px;
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: background 0.3s ease;
                }

                .search-button:hover {
                    background: #1976D2;
                }

                .loading {
                    opacity: 0.7;
                    pointer-events: none;
                }

                .error-message {
                    color: #f44336;
                    margin-top: 8px;
                    font-size: 14px;
                    text-align: center;
                }
            </style>

            <div class="search-container">
                <input type="text" 
                       class="search-input" 
                       placeholder="Buscar términos LOINC..."
                       aria-label="Buscar términos LOINC">
                <button class="search-button" aria-label="Buscar">
                    Buscar
                </button>
            </div>
            <div class="error-message"></div>
        `;
    }

    setupEventListeners() {
        const input = this.shadowRoot.querySelector('.search-input');
        const button = this.shadowRoot.querySelector('.search-button');
        const container = this.shadowRoot.querySelector('.search-container');
        const errorMessage = this.shadowRoot.querySelector('.error-message');

        // Búsqueda al hacer click
        button.addEventListener('click', () => this.handleSearch(input, container, errorMessage));

        // Búsqueda al presionar Enter
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch(input, container, errorMessage);
            }
        });
    }

    async handleSearch(input, container, errorMessage) {
        const term = input.value.trim();
        
        if (!term) {
            errorMessage.textContent = 'Por favor, introduce un término para buscar';
            return;
        }

        try {
            // Activar estado de carga
            container.classList.add('loading');
            errorMessage.textContent = '';

            // Realizar búsqueda
            const result = await searchService.search(term);

            if (!result.success) {
                throw new Error(result.message);
            }

            // Disparar evento con los resultados
            this.dispatchEvent(new CustomEvent('search-results', {
                detail: result.data,
                bubbles: true,
                composed: true
            }));

        } catch (error) {
            console.error('Error en búsqueda:', error);
            errorMessage.textContent = error.message;
        } finally {
            // Desactivar estado de carga
            container.classList.remove('loading');
        }
    }
}

customElements.define('search-box', SearchBox); 