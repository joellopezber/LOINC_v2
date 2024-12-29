import { storageService } from './storage.service.js';

class OntologyStorageService {
    constructor() {
        this.maxResults = 100;
        this.logger = this._createLogger();
        this.STORAGE_KEY = 'ontologyResults';
        console.log('🔄 [OntologyStorage] Inicializando con key:', this.STORAGE_KEY);
    }

    _createLogger() {
        return {
            info: (msg, data) => console.log(`📚 [OntologyStorage] ${msg}`, data || ''),
            error: (msg, error) => console.error(`❌ [OntologyStorage] ${msg}`, error || ''),
            debug: (msg, data) => console.debug(`🔍 [OntologyStorage] ${msg}`, data || '')
        };
    }

    async saveResult(term, result) {
        try {
            this.logger.debug('Guardando resultado para término:', term);
            this.logger.debug('Datos a guardar:', result);
            
            const results = await this.getResults();
            this.logger.debug('Resultados actuales:', results);
            
            results[term] = {
                data: result,
                timestamp: Date.now(),
                searchCount: (results[term]?.searchCount || 0) + 1
            };

            // Gestión de límite de resultados
            const terms = Object.keys(results);
            if (terms.length > this.maxResults) {
                this.logger.debug('Límite de resultados alcanzado, eliminando antiguos...');
                const oldestTerm = terms
                    .sort((a, b) => results[a].timestamp - results[b].timestamp)[0];
                delete results[oldestTerm];
            }

            // Usar storageService en lugar de storage directamente
            this.logger.debug('Guardando en storage:', results);
            await storageService.set(this.STORAGE_KEY, results);
            
            // Verificar que se guardó correctamente
            const savedResults = await this.getResults();
            this.logger.debug('Verificación de guardado:', savedResults);
            
            this.logger.info('Resultado guardado correctamente');
            return true;

        } catch (error) {
            this.logger.error('Error guardando resultado:', error);
            return false;
        }
    }

    async getResults() {
        try {
            // Usar storageService en lugar de storage directamente
            const results = await storageService.get(this.STORAGE_KEY);
            this.logger.debug('Resultados obtenidos:', results);
            return results || {};
        } catch (error) {
            this.logger.error('Error obteniendo resultados:', error);
            return {};
        }
    }

    async getResult(term) {
        try {
            const results = await this.getResults();
            const result = results[term] || null;
            this.logger.debug(`Resultado para término "${term}":`, result);
            return result;
        } catch (error) {
            this.logger.error('Error obteniendo resultado específico:', error);
            return null;
        }
    }

    async clearResults() {
        try {
            // Usar storageService en lugar de storage directamente
            await storageService.set(this.STORAGE_KEY, {});
            this.logger.info('Resultados limpiados correctamente');
            return true;
        } catch (error) {
            this.logger.error('Error limpiando resultados:', error);
            return false;
        }
    }
}

export const ontologyStorage = new OntologyStorageService(); 