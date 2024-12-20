import SearchComponent from './components/search.js';
import { apiClient } from './api/client.js';
import configModal from './components/config-modal.js';
import { storage } from './utils/storage.js';

// Inicializar storage primero
window.storage = storage;
console.log('Storage inicializado:', window.storage.getConfig());

document.addEventListener('DOMContentLoaded', () => {
    // Crear contenedor del modal
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modalContainer';
    document.body.appendChild(modalContainer);

    // Inicializar componentes
    window.searchComponent = new SearchComponent();
    window.apiClient = apiClient;
    window.configModal = configModal;

    // Manejar el submit del formulario de búsqueda
    const searchForm = document.querySelector('.search-box');
    const searchInput = document.querySelector('.search-input');
    const configButton = document.querySelector('.config-button');

    // Manejar click en botón de configuración
    if (configButton) {
        configButton.addEventListener('click', () => {
            console.log('Click en botón de configuración');
            document.dispatchEvent(new CustomEvent('modal:open'));
        });
    } else {
        console.error('No se encontró el botón de configuración');
    }

    searchForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const term = searchInput.value.trim();
        if (term) {
            document.dispatchEvent(new CustomEvent('search:execute', {
                detail: { term }
            }));
        }
    });

    // Escuchar eventos de búsqueda
    document.addEventListener('search:start', () => {
        searchForm?.classList.add('loading');
    });

    document.addEventListener('search:complete', (event) => {
        searchForm?.classList.remove('loading');
        const { results, stats } = event.detail;
    });

    document.addEventListener('search:error', (event) => {
        searchForm?.classList.remove('loading');
    });
}); 