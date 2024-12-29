import { ontologyStorage } from './ontology-storage.service.js';

class OntologyService {
    constructor() {
        this.storage = ontologyStorage;
        this.listeners = new Set();
        this.logger = this._createLogger();
        console.log('🔄 OntologyService inicializado');
        this.setupWebSocket();
    }

    _createLogger() {
        return {
            info: (msg, data) => console.log(`🔍 [OntologyService] ${msg}`, data || ''),
            error: (msg, error) => console.error(`❌ [OntologyService] ${msg}`, error || ''),
            debug: (msg, data) => console.debug(`🔍 [OntologyService] ${msg}`, data || '')
        };
    }

    _validateResponse(response) {
        this.logger.debug('Validando respuesta:', response);
        
        // Validar estructura básica
        if (!response || !response.status || !response.query || !response.response) {
            this.logger.error('Respuesta inválida:', response);
            return false;
        }

        const data = response.response;
        this.logger.debug('Datos a validar:', data);
        
        // Validar campos requeridos
        const requiredFields = [
            'original_term',
            'term_in_english',
            'related_terms',
            'test_types',
            'loinc_codes',
            'keywords'
        ];

        for (const field of requiredFields) {
            if (!data[field]) {
                this.logger.error(`Campo requerido faltante: ${field}`);
                return false;
            }
        }

        // Validar que los arrays sean arrays
        const arrayFields = ['related_terms', 'test_types', 'loinc_codes', 'keywords'];
        for (const field of arrayFields) {
            if (!Array.isArray(data[field])) {
                this.logger.error(`Campo ${field} debe ser un array`);
                return false;
            }
        }

        // Validar formato de códigos LOINC
        const loincPattern = /^\d+-\d+$/;
        if (!data.loinc_codes.every(code => loincPattern.test(code))) {
            this.logger.error('Formato inválido en códigos LOINC');
            return false;
        }

        this.logger.debug('Validación completada exitosamente');
        return true;
    }

    setupWebSocket() {
        if (!window.socket) {
            this.logger.error('WebSocket no disponible');
            return;
        }

        this.logger.debug('Configurando WebSocket listener');
        window.socket.on('ontology.search_result', async (response) => {
            try {
                this.logger.debug('🔄 Respuesta WebSocket recibida:', response);

                if (response.status === 'success') {
                    // Validar estructura de la respuesta
                    if (!this._validateResponse(response)) {
                        this.logger.error('❌ Validación de respuesta fallida');
                        return;
                    }

                    this.logger.debug('✅ Validación exitosa, guardando resultado');
                    // 1. Almacenar resultado
                    await this.storage.saveResult(
                        response.query, 
                        response.response
                    );
                    
                    this.logger.debug('📢 Notificando a listeners');
                    // 2. Notificar a los listeners
                    this.notifyListeners(response);
                    
                    this.logger.info('✅ Proceso completado correctamente');
                } else {
                    this.logger.error('Error en respuesta:', response.message);
                }
            } catch (error) {
                this.logger.error('Error procesando respuesta:', error);
            }
        });
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
            window.socket.emit('ontology.search', { text: term });
            this.logger.debug('✅ Búsqueda enviada');

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