import { websocketService } from './websocket.service.js';
import { storageService } from './storage.service.js';

class DatabaseSearchService {
    constructor() {
        this._listeners = new Set();
        this._serviceStatus = {
            elastic: { available: false, stats: null, error: null },
            sql: { available: false, stats: null, error: null },
            preferred: null
        };
        this._setupWebSocket();
        this._setupReconnection();
        this.REQUEST_TIMEOUT = 30000;
    }

    _setupWebSocket() {
        // Limpiar listeners anteriores
        websocketService.off('database.result');
        websocketService.off('database.test_result');
        websocketService.off('database.status_result');

        // Escuchar resultados de búsqueda
        websocketService.on('database.result', (response) => {
            console.log('📩 Resultado de búsqueda recibido:', response);
            this._notifyListeners(response);
        });

        // Escuchar resultados de test
        websocketService.on('database.test_result', (response) => {
            console.log('🧪 Resultado de test recibido:', response);
            this._notifyListeners(response);
        });

        // Escuchar estado del servicio
        websocketService.on('database.status_result', (response) => {
            console.log('📊 Estado del servicio recibido:', response);
            if (response.status === 'success') {
                this._updateServiceStatus(response.service_status);
            }
            this._notifyListeners(response);
        });
    }

    _updateServiceStatus(status) {
        if (status.elastic) {
            this._serviceStatus.elastic = {
                available: status.elastic.available || false,
                stats: status.elastic.stats || null,
                error: status.elastic.error || null
            };
        }
        
        if (status.sql) {
            this._serviceStatus.sql = {
                available: status.sql.available || false,
                stats: status.sql.stats || null,
                error: status.sql.error || null
            };
        }

        if (status.preferred) {
            this._serviceStatus.preferred = status.preferred;
        }

        console.log('📊 Estado actualizado:', this._serviceStatus);
    }

    _setupReconnection() {
        websocketService.on('connect', () => {
            console.log('🔄 Reconectado, reconfigurando listeners...');
            this._setupWebSocket();
            // Actualizar estado al reconectar
            this._requestStatus().catch(error => {
                console.error('❌ Error actualizando estado tras reconexión:', error);
            });
        });
    }

    addListener(callback) {
        this._listeners.add(callback);
        return () => {
            console.log('🧹 Eliminando listener');
            this._listeners.delete(callback);
        };
    }

    _notifyListeners(data) {
        this._listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('❌ Error en listener:', error);
            }
        });
    }

    _getInstallId() {
        const installId = storageService.get('install_id');
        if (!installId) {
            throw new Error('ID de instalación no disponible');
        }
        return installId;
    }

    async _requestStatus() {
        if (!websocketService.isConnected()) {
            throw new Error('No hay conexión con el servidor');
        }

        try {
            const response = await Promise.race([
                websocketService.sendRequest('database.status', {
                    install_id: this._getInstallId()
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout en la petición')), this.REQUEST_TIMEOUT)
                )
            ]);

            return response;
        } catch (error) {
            console.error('❌ Error obteniendo estado:', error);
            throw error;
        }
    }

    async _sendRequest(event, data, timeout = this.REQUEST_TIMEOUT) {
        if (!websocketService.isConnected()) {
            throw new Error('No hay conexión con el servidor');
        }

        // No verificar disponibilidad para peticiones de estado
        if (event !== 'database.status') {
            // Verificar si hay algún servicio disponible
            if (!this._serviceStatus.elastic.available && !this._serviceStatus.sql.available) {
                throw new Error('No hay servicios de búsqueda disponibles');
            }
        }

        try {
            const response = await Promise.race([
                websocketService.sendRequest(event, {
                    ...data,
                    install_id: this._getInstallId()
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout en la petición')), timeout)
                )
            ]);

            return response;
        } catch (error) {
            console.error(`❌ Error en petición ${event}:`, error);
            throw error;
        }
    }

    getServiceStatus() {
        return this._serviceStatus;
    }

    async search(query, limit = 10) {
        return this._sendRequest('database.search', { query, limit });
    }

    async getStatus() {
        return this._requestStatus();
    }

    async runTest(testData) {
        return this._sendRequest('database.test', testData);
    }

    async setPreferredService(service) {
        if (!['elastic', 'sql'].includes(service)) {
            throw new Error('Servicio no válido');
        }

        // Verificar si el servicio solicitado está disponible
        if (!this._serviceStatus[service]?.available) {
            throw new Error(`El servicio ${service} no está disponible`);
        }

        return this._sendRequest('database.set_preferred_service', { service });
    }

    destroy() {
        console.log('🧹 Limpiando DatabaseSearchService');
        websocketService.off('database.result');
        websocketService.off('database.test_result');
        websocketService.off('database.status_result');
        websocketService.off('connect');
        this._listeners.clear();
    }
}

// Exportar instancia única
export const databaseSearchService = new DatabaseSearchService(); 