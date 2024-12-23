import { storage } from '../utils/storage.js';

/**
 * Servicio para gestionar el almacenamiento local con sincronización WebSocket
 */
class StorageService {
    constructor() {
        this.logger = this._createLogger();
        this.logger.info('Servicio inicializado');
        this.initialized = false;
        this.initializing = false;
        this.lastSyncTime = 0;
        this.pendingSync = false;
        this.configCache = null;
        this.configCacheTime = 0;
        this.configCacheTimeout = 1000; // 1 segundo

        // Escuchar eventos de storage.js
        window.addEventListener('storage:config_updated', async (event) => {
            this.logger.debug('Configuración actualizada en storage.js');
            if (window.socket?.connected && !this.pendingSync) {
                this.pendingSync = true;
                await this._syncWithServer();
                this.pendingSync = false;
            }
        });
    }

    /**
     * Inicializa el servicio y sincroniza con el backend
     */
    async initialize() {
        // Si ya está inicializado, retornar inmediatamente
        if (this.initialized) {
            this.logger.debug('Ya inicializado');
            return true;
        }

        // Si está en proceso de inicialización, esperar
        if (this.initializing) {
            this.logger.debug('Esperando inicialización...');
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.initialized) {
                        clearInterval(checkInterval);
                        resolve(true);
                    }
                }, 100);

                // Timeout después de 5 segundos
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(this.initialized);
                }, 5000);
            });
        }

        this.initializing = true;
        this.logger.info('Iniciando...');
        
        try {
            // Obtener configuración inicial
            const config = await storage.getConfig();
            this.logger.debug('Config inicial', config);

            // Esperar a que el WebSocket esté disponible
            await this._waitForWebSocket();

            // Configurar WebSocket
            this._setupWebSocket();

            // Sincronizar con el backend
            if (window.socket?.connected) {
                await this._syncWithServer();
            }

            this.initialized = true;
            this.initializing = false;
            this.logger.info('✅ Inicializado');
            return true;
        } catch (error) {
            this.logger.error('Error en inicialización', error);
            this.initializing = false;
            return false;
        }
    }

    /**
     * Espera a que el WebSocket esté disponible
     */
    async _waitForWebSocket() {
        if (window.socket) {
            return;
        }

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (window.socket) {
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
                return `{${Object.keys(value).join(', ')}}`;
            }
            return value;
        };

        return {
            info: (msg, data) => {
                if (data) {
                    console.log(`💾 [Storage] ${msg}`, formatValue(data));
                } else {
                    console.log(`💾 [Storage] ${msg}`);
                }
            },
            error: (msg, error) => {
                if (error) {
                    console.error(`❌ [Storage] ${msg}`, error);
                } else {
                    console.error(`❌ [Storage] ${msg}`);
                }
            },
            debug: (msg, data) => {
                if (data) {
                    console.debug(`🔍 [Storage] ${msg}`, formatValue(data));
                } else {
                    console.debug(`🔍 [Storage] ${msg}`);
                }
            },
            warn: (msg, data) => {
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
            this.logger.debug('Actualización del servidor', data);
            const { key, value } = data;
            try {
                if (key === 'searchConfig') {
                    await storage.setConfig(value);
                    this.logger.debug('Config actualizada desde servidor');
                }
            } catch (error) {
                this.logger.error('Error actualizando valor', error);
            }
        });

        // Escuchar reconexión
        window.socket.on('connect', async () => {
            this.logger.info('Reconectado');
            await this._syncWithServer();
        });
    }

    /**
     * Sincroniza con el servidor después de reconexión
     */
    async _syncWithServer() {
        try {
            // Evitar sincronizaciones muy frecuentes (mínimo 1 segundo entre cada una)
            const now = Date.now();
            if (now - this.lastSyncTime < 1000) {
                this.logger.debug('Sincronización omitida - muy frecuente');
                return false;
            }
            this.lastSyncTime = now;

            const config = await storage.getConfig();
            window.socket.emit('storage.set_value', {
                key: 'searchConfig',
                value: config,
                request_id: `sync_${now}`
            });
            this.logger.debug('Configuración sincronizada con servidor');
            return true;
        } catch (error) {
            this.logger.error('Error al sincronizar con servidor:', error);
            return false;
        } finally {
            this.pendingSync = false;
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
                this.logger.debug('Usando configuración cacheada');
                return this.configCache;
            }

            const config = await storage.getConfig();
            this.logger.debug('Obteniendo configuración:', config);
            
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
            await storage.setConfig(config);
            
            // Notificar al servidor del cambio
            if (window.socket?.connected) {
                await this._syncWithServer();
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
        if (key === 'searchConfig') {
            return this.getSearchConfig();
        }
        return null;
    }

    /**
     * Establece un valor (para compatibilidad con tests)
     */
    async set(key, value) {
        if (key === 'searchConfig') {
            return this.saveSearchConfig(value);
        }
        return false;
    }
}

// Crear instancia y exportar
const storageService = new StorageService();
window.storageService = storageService;
export { storageService };