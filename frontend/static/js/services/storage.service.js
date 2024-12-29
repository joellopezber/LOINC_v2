import { storage } from '../utils/storage.js';

/**
 * Servicio para gestionar el almacenamiento local con sincronización WebSocket
 */
class StorageService {
    constructor() {
        this.logger = this._createLogger();
        this.logger.debug('Creando instancia...');
        this.initialized = false;
        this.initializing = false;
        this.lastSyncTime = 0;
        this.pendingSync = false;
        this.syncQueue = [];
        this.configCache = null;
        this.configCacheTime = 0;
        this.configCacheTimeout = 1000; // 1 segundo
        this.updateTimeout = null;
        this.initPromise = null;
        this.ignoreNextUpdate = false;
        this.wsConfigured = false;

        // Escuchar eventos de storage.js con debounce
        window.addEventListener('storage:config_updated', async () => {
            if (this.ignoreNextUpdate) {
                this.ignoreNextUpdate = false;
                return;
            }

            this.logger.debug('Configuración actualizada en storage.js');
            
            // Cancelar timeout anterior si existe
            if (this.updateTimeout) {
                clearTimeout(this.updateTimeout);
            }

            // Esperar 100ms antes de sincronizar para agrupar actualizaciones
            this.updateTimeout = setTimeout(async () => {
                await this.queueSync();
            }, 100);
        });
    }

    /**
     * Inicializa el servicio y sincroniza con el backend
     */
    async initialize() {
        // Si ya hay una inicialización en curso, retornar la promesa existente
        if (this.initPromise) {
            this.logger.debug('Inicialización en curso...');
            return this.initPromise;
        }

        // Si ya está inicializado, retornar inmediatamente
        if (this.initialized) {
            this.logger.debug('Servicio ya inicializado');
            return true;
        }

        this.initPromise = (async () => {
            try {
                this.initializing = true;
                this.logger.debug('Iniciando servicio...');
                
                // Inicializar storage.js primero
                await storage.initialize();
                
                // Obtener configuración inicial
                const config = await storage.getConfig();
                this.logger.debug('Config inicial', config);

                // Esperar a que el WebSocket esté disponible
                await this._waitForWebSocket();

                // Configurar WebSocket solo si no está ya configurado
                if (!this.wsConfigured) {
                    this._setupWebSocket();
                    this.wsConfigured = true;
                }

                // Sincronizar con el backend
                if (window.socket?.connected) {
                    await this._syncWithServer();
                }

                this.initialized = true;
                this.logger.debug('✅ Servicio inicializado');
                return true;
            } catch (error) {
                this.logger.error('Error en inicialización', error);
                return false;
            } finally {
                this.initializing = false;
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    /**
     * Espera a que el WebSocket esté disponible
     */
    async _waitForWebSocket() {
        if (window.socket?.connected) {
            return;
        }

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (window.socket?.connected) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Timeout después de 5 segundos
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 5000);
        });
    }

    /**
     * Crea un logger consistente
     */
    _createLogger() {
        const formatValue = (value) => {
            if (typeof value === 'object') {
                // Limitar la profundidad del objeto para logs más limpios
                const keys = Object.keys(value);
                if (keys.length > 3) {
                    return `{${keys.slice(0, 3).join(', ')}...}`;
                }
                return `{${keys.join(', ')}}`;
            }
            return value;
        };

        // Evitar logs duplicados
        let lastMsg = '';
        let lastTime = 0;
        const DUPLICATE_TIMEOUT = 1000; // 1 segundo

        const shouldLog = (msg) => {
            const now = Date.now();
            if (msg === lastMsg && now - lastTime < DUPLICATE_TIMEOUT) {
                return false;
            }
            lastMsg = msg;
            lastTime = now;
            return true;
        };

        return {
            info: (msg, data) => {
                if (!shouldLog(msg)) return;
                if (data) {
                    console.log(`💾 [Storage] ${msg}`, formatValue(data));
                } else {
                    console.log(`💾 [Storage] ${msg}`);
                }
            },
            error: (msg, error) => {
                // Siempre mostrar errores
                if (error) {
                    console.error(`❌ [Storage] ${msg}`, error);
                } else {
                    console.error(`❌ [Storage] ${msg}`);
                }
            },
            debug: (msg, data) => {
                if (!shouldLog(msg)) return;
                if (data) {
                    console.debug(`🔍 [Storage] ${msg}`, formatValue(data));
                } else {
                    console.debug(`🔍 [Storage] ${msg}`);
                }
            },
            warn: (msg, data) => {
                // Siempre mostrar warnings
                if (data) {
                    console.warn(`⚠️ [Storage] ${msg}`, formatValue(data));
                } else {
                    console.warn(`⚠️ [Storage] ${msg}`);
                }
            }
        };
    }

    /**
     * Configura los manejadores de eventos del WebSocket
     */
    _setupWebSocket() {
        if (!window.socket) {
            this.logger.error('WebSocket no disponible');
            return;
        }

        // Escuchar actualizaciones del servidor
        window.socket.on('storage.value_updated', async (data) => {
            const { key, value } = data;
            
            // Evitar bucles de actualización
            if (this.pendingSync) {
                this.logger.debug('⏳ Actualización ignorada - sincronización en curso');
                return;
            }

            try {
                this.ignoreNextUpdate = true;
                switch(key) {
                    case 'searchConfig':
                        await storage.setConfig(value);
                        this.logger.debug('✅ Config actualizada');
                        break;
                    case 'openaiApiKey':
                        localStorage.setItem('openaiApiKey', value);
                        this.logger.debug('✅ API key actualizada');
                        break;
                    case 'installTimestamp':
                        localStorage.setItem('installTimestamp', value);
                        this.logger.debug('✅ Timestamp actualizado');
                        break;
                }
            } catch (error) {
                this.logger.error('Error actualizando valor', error);
            }
        });

        // Escuchar reconexión
        window.socket.on('connect', async () => {
            // Evitar sincronización si ya hay una en curso
            if (this.pendingSync) {
                this.logger.debug('⏳ Reconexión ignorada - sincronización en curso');
                return;
            }
            
            this.logger.info('🔄 Reconectado - sincronizando...');
            await this.queueSync({ force: true });
        });

        // Escuchar desconexión
        window.socket.on('disconnect', () => {
            this.logger.warn('🔌 Desconectado del servidor');
        });
    }

    /**
     * Añade una sincronización a la cola
     */
    async queueSync(options = { force: false }) {
        // Si ya hay una sincronización pendiente en la cola y no es forzada, usar esa
        if (this.syncQueue.length > 0 && !options.force) {
            return new Promise((resolve) => {
                this.syncQueue.push(resolve);
            });
        }

        // Si es forzada, limpiar cola anterior
        if (options.force) {
            this.syncQueue = [];
        }

        return new Promise((resolve) => {
            this.syncQueue.push(resolve);
            this.processQueue();
        });
    }

    /**
     * Procesa la cola de sincronización
     */
    async processQueue() {
        if (this.pendingSync || this.syncQueue.length === 0) {
            return;
        }

        this.pendingSync = true;
        let success = false;

        try {
            success = await this._syncWithServer();
            
            // Notificar a todos los que están esperando
            const resolvers = [...this.syncQueue];
            this.syncQueue = [];
            
            resolvers.forEach(resolve => resolve(success));
        } catch (error) {
            this.logger.error('Error procesando cola:', error);
            // Notificar error a todos los que están esperando
            const resolvers = [...this.syncQueue];
            this.syncQueue = [];
            resolvers.forEach(resolve => resolve(false));
        } finally {
            this.pendingSync = false;
            
            // Si hay nuevas solicitudes, esperar un poco antes de procesar
            if (this.syncQueue.length > 0) {
                setTimeout(() => this.processQueue(), 100);
            }
        }
    }

    /**
     * Sincroniza con el servidor después de reconexión
     */
    async _syncWithServer() {
        try {
            // Evitar sincronizaciones muy frecuentes (mínimo 1 segundo entre cada una)
            const now = Date.now();
            const timeSinceLastSync = now - this.lastSyncTime;
            
            if (timeSinceLastSync < 1000) {
                const waitTime = 1000 - timeSinceLastSync;
                this.logger.debug(`⏳ Sincronización pospuesta - esperando ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // Solo sincronizar si hay conexión WebSocket
            if (!window.socket?.connected) {
                this.logger.warn('🔌 WebSocket no conectado - sincronización pospuesta');
                return false;
            }

            // Obtener valores actuales
            const [config, apiKey, timestamp] = await Promise.all([
                this.getSearchConfig(), // Usar getSearchConfig para aprovechar el caché
                localStorage.getItem('openaiApiKey'),
                localStorage.getItem('installTimestamp')
            ]);

            if (!config && !apiKey && !timestamp) {
                this.logger.debug('⏭️ Nada que sincronizar');
                return true;
            }

            this.lastSyncTime = Date.now();
            const syncId = `sync_${this.lastSyncTime}`;
            
            this.logger.debug('📤 Sincronizando valores...');

            // Enviar valores en paralelo
            const promises = [];
            
            if (config) {
                promises.push(new Promise((resolve) => {
                    window.socket.emit('storage.set_value', {
                        key: 'searchConfig',
                        value: config,
                        request_id: `${syncId}_config`
                    });
                    resolve();
                }));
            }

            if (apiKey) {
                promises.push(new Promise((resolve) => {
                    window.socket.emit('storage.set_value', {
                        key: 'openaiApiKey',
                        value: apiKey,
                        request_id: `${syncId}_apikey`
                    });
                    resolve();
                }));
            }

            if (timestamp) {
                promises.push(new Promise((resolve) => {
                    window.socket.emit('storage.set_value', {
                        key: 'installTimestamp',
                        value: timestamp,
                        request_id: `${syncId}_timestamp`
                    });
                    resolve();
                }));
            }

            // Esperar a que todas las operaciones terminen
            await Promise.all(promises);
            this.logger.debug('✅ Sincronización completada');
            return true;
        } catch (error) {
            this.logger.error('❌ Error al sincronizar:', error);
            return false;
        }
    }

    /**
     * Obtiene la configuración de búsqueda
     */
    async getSearchConfig() {
        try {
            // Usar caché si está disponible y no ha expirado
            const now = Date.now();
            if (this.configCache && now - this.configCacheTime < this.configCacheTimeout) {
                return this.configCache;
            }

            const config = await storage.getConfig();
            
            // Actualizar caché
            this.configCache = config;
            this.configCacheTime = now;
            
            return config;
        } catch (error) {
            this.logger.error('Error al obtener configuración', error);
            return null;
        }
    }

    /**
     * Guarda la configuración de búsqueda
     */
    async saveSearchConfig(config) {
        try {
            this.logger.info('Guardando nueva configuración...');
            
            // Ignorar el próximo evento de storage.js
            this.ignoreNextUpdate = true;
            await storage.setConfig(config);
            
            // Notificar al servidor del cambio
            if (window.socket?.connected) {
                await this.queueSync();
            } else {
                this.logger.warn('WebSocket no conectado - cambios solo guardados localmente');
            }
            
            return true;
        } catch (error) {
            this.logger.error('Error al guardar configuración', error);
            return false;
        }
    }

    /**
     * Obtiene un valor (para compatibilidad con tests)
     */
    async get(key) {
        try {
            console.log('🔍 [StorageService] Obteniendo valor para key:', key);
            if (key === 'searchConfig') {
                return this.getSearchConfig();
            }
            // Añadir soporte para ontologyResults
            if (key === 'ontologyResults') {
                const value = localStorage.getItem(key);
                console.log('📦 [StorageService] Valor obtenido para ontologyResults:', value);
                return value ? JSON.parse(value) : null;
            }
            return null;
        } catch (error) {
            console.error('❌ [StorageService] Error en get:', error);
            return null;
        }
    }

    /**
     * Establece un valor (para compatibilidad con tests)
     */
    async set(key, value) {
        try {
            console.log('💾 [StorageService] Guardando valor para key:', key);
            console.log('📝 [StorageService] Valor a guardar:', value);
            
            if (key === 'searchConfig') {
                return this.saveSearchConfig(value);
            }
            // Añadir soporte para ontologyResults
            if (key === 'ontologyResults') {
                localStorage.setItem(key, JSON.stringify(value));
                console.log('✅ [StorageService] Valor guardado en ontologyResults');
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ [StorageService] Error en set:', error);
            return false;
        }
    }
}

// Crear instancia y exportar
const storageService = new StorageService();
window.storageService = storageService;
export { storageService };