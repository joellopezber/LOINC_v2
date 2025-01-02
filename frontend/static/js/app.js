import SearchComponent from './components/search.js';
import { apiClient } from './api/client.js';
import { ConfigModal } from './components/config-modal.js';
import { storage } from './utils/storage.js';
import { websocketService } from './services/websocket.service.js';
import { storageService } from './services/storage.service.js';

class App {
    constructor() {
        this.services = {
            storage: null,
            websocket: null,
            storageService: null,
            apiClient: null
        };
        
        this.components = {
            search: null,
            configModal: null
        };
    }

    async initialize() {
        try {
            console.group('🚀 Iniciando aplicación...');
            
            await this._initializeServices();
            await this._initializeComponents();
            this._setupEventListeners();
            
            console.groupEnd();
            console.log('✨ Aplicación lista');
            return true;
        } catch (error) {
            console.error('❌ Error:', error);
            return false;
        }
    }

    async _initializeServices() {
        this.services.storage = storage;
        await this.services.storage.initialize();
        console.log('├── 💾 Storage');

        this.services.websocket = websocketService;
        await this.services.websocket.connect();
        console.log('├── 🔌 WebSocket');

        this.services.storageService = storageService;
        await this.services.storageService.initialize();
        console.log('├── 🔧 StorageService');

        this.services.apiClient = apiClient;
        console.log('└── 🔨 API Client');
    }

    async _initializeComponents() {
        this.components.search = new SearchComponent(this.services);
        this.components.configModal = new ConfigModal(this.services);
        
        console.log('└── 🎯 Componentes');
    }

    _setupEventListeners() {
        // Eventos de búsqueda
        const searchForm = document.querySelector('.search-box');
        const searchInput = document.querySelector('.search-input');
        const configButton = document.querySelector('.config-button');

        if (configButton) {
            configButton.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('modal:open'));
            });
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

        // Eventos de la aplicación
        window.addEventListener('unload', () => {
            this.services.websocket.disconnect();
        });

        // Eventos de búsqueda
        document.addEventListener('search:start', () => {
            searchForm?.classList.add('loading');
        });

        document.addEventListener('search:complete', (event) => {
            searchForm?.classList.remove('loading');
        });

        document.addEventListener('search:error', () => {
            searchForm?.classList.remove('loading');
        });
    }
}

// Crear y exportar instancia única
export const app = new App();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
}); 