import { ontologyStorage } from './ontology-storage.service.js';
import { websocketService } from './websocket.service.js';

class OntologyService {
    constructor() {
        this.storage = ontologyStorage;
        this.listeners = new Set();
        this.logger = this._createLogger();
        console.log('🔄 OntologyService inicializado');
    }

    _createLogger() {
        return {
            info: (msg, data) => console.log(`🔍 [OntologyService] ${msg}`, data || ''),
            error: (msg, error) => console.error(`❌ [OntologyService] ${msg}`, error || ''),
            debug: (msg, data) => console.debug(`🔍 [OntologyService] ${msg}`, data || '')
        };
    }

    addListener(callback) {
        this.logger.debug('Añadiendo nuevo listener');
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
            this.logger.debug('Listener eliminado');
        };
    }

    notifyListeners(data) {
        this.logger.debug(`Notificando a ${this.listeners.size} listeners`);
        this.listeners.forEach(listener => {
            try {
                this.logger.debug('Enviando datos a listener:', data);
                listener(data);
            } catch (error) {
                this.logger.error('Error en listener:', error);
            }
        });
    }

    async search(term) {
        try {
            this.logger.debug('🔍 Iniciando búsqueda:', term);
            
            // Verificar si ya tenemos el resultado en caché
            const cached = await this.storage.getResult(term);
            if (cached) {
                this.logger.debug('📦 Resultado encontrado en caché:', cached);
                // Notificar resultado cacheado
                this.notifyListeners({
                    status: 'success',
                    query: term,
                    response: cached.data,
                    fromCache: true
                });
            }

            // Siempre realizar la búsqueda para mantener resultados actualizados
            this.logger.debug('📡 Enviando búsqueda al servidor');
            
            // Usar websocketService para la comunicación
            this.logger.debug('🔄 Preparando petición WebSocket');
            const response = await websocketService.sendRequest('ontology.search', { 
                text: term 
            });
            this.logger.debug('📩 Respuesta recibida:', response);

            // Si llegamos aquí, la respuesta fue exitosa
            this.logger.debug('✅ Búsqueda completada');

            // Guardar resultado en almacenamiento local
            if (response.status === 'success' && response.response) {
                await this.storage.saveResult(term, response.response);
            }

            // Notificar a los listeners con la respuesta
            if (!response.fromCache) {
                this.logger.debug('📢 Notificando a listeners con respuesta del servidor');
                this.notifyListeners(response);
            }

        } catch (error) {
            this.logger.error('❌ Error en búsqueda:', error);
            throw error;
        }
    }

    async getSearchHistory() {
        try {
            const results = await this.storage.getResults();
            return Object.entries(results)
                .map(([term, data]) => ({
                    term,
                    timestamp: data.timestamp,
                    searchCount: data.searchCount
                }))
                .sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            this.logger.error('Error obteniendo historial:', error);
            return [];
        }
    }
}

// Exportar instancia única
export const ontologyService = new OntologyService(); 