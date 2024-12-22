/**
 * Servicio para gestionar el almacenamiento local
 */
class StorageService {
    constructor() {
        this.logger = this._createLogger();
        this.defaultConfig = {
            search: {
                ontologyMode: 'multi_match',
                dbMode: 'sql',
                openai: {
                    useOriginalTerm: true,
                    useEnglishTerm: false,
                    useRelatedTerms: false,
                    useTestTypes: false,
                    useLoincCodes: true,
                    useKeywords: true
                }
            },
            sql: {
                maxTotal: 150,
                maxPerKeyword: 20,
                maxKeywords: 10,
                strictMode: true
            },
            elastic: {
                limits: {
                    maxTotal: 50,
                    maxPerKeyword: 20
                },
                searchTypes: {
                    exact: {
                        enabled: false,
                        priority: 10
                    },
                    fuzzy: {
                        enabled: false,
                        tolerance: 2
                    },
                    smart: {
                        enabled: false,
                        precision: 7
                    }
                },
                showAdvanced: false
            },
            performance: {
                maxCacheSize: 100,
                cacheExpiry: 24
            }
        };
        this.logger.info('Servicio inicializado');
    }

    /**
     * Crea un logger consistente
     */
    _createLogger() {
        return {
            info: (msg) => console.log(`💾 [Storage] ${msg}`),
            error: (msg, error) => console.error(`❌ [Storage] ${msg}`, error),
            debug: (msg) => console.debug(`🔍 [Storage] ${msg}`)
        };
    }

    /**
     * Inicializa el almacenamiento
     */
    async initialize() {
        try {
            // Verificar si es primera ejecución
            if (!localStorage.getItem('installTimestamp')) {
                this.logger.info('Primera ejecución detectada');
                await this._firstRun();
            }

            // Cargar y validar configuración
            await this._loadConfig();
            
            this.logger.info('Almacenamiento inicializado');
            return true;
        } catch (error) {
            this.logger.error('Error al inicializar', error);
            return false;
        }
    }

    /**
     * Configura el almacenamiento en primera ejecución
     */
    async _firstRun() {
        try {
            // Marcar timestamp de instalación
            localStorage.setItem('installTimestamp', Date.now());
            
            // Guardar configuración por defecto
            localStorage.setItem('searchConfig', JSON.stringify(this.defaultConfig));
            
            this.logger.info('Primera ejecución completada');
            return true;
        } catch (error) {
            this.logger.error('Error en primera ejecución', error);
            return false;
        }
    }

    /**
     * Carga y valida la configuración
     */
    async _loadConfig() {
        try {
            const config = localStorage.getItem('searchConfig');
            if (!config) {
                this.logger.debug('No hay configuración guardada, usando valores por defecto');
                localStorage.setItem('searchConfig', JSON.stringify(this.defaultConfig));
                return this.defaultConfig;
            }

            const parsedConfig = JSON.parse(config);
            this.logger.debug('Configuración cargada');
            return parsedConfig;
        } catch (error) {
            this.logger.error('Error cargando configuración', error);
            return this.defaultConfig;
        }
    }

    /**
     * Obtiene un valor del almacenamiento
     */
    async get(key) {
        try {
            const value = localStorage.getItem(key);
            if (!value) {
                this.logger.debug(`No hay valor para ${key}`);
                return null;
            }

            const parsedValue = JSON.parse(value);
            this.logger.debug(`Valor obtenido: ${key}`);
            return parsedValue;
        } catch (error) {
            this.logger.error(`Error al obtener ${key}`, error);
            return null;
        }
    }

    /**
     * Establece un valor en el almacenamiento
     */
    async set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            this.logger.debug(`Valor establecido: ${key}`);
            return true;
        } catch (error) {
            this.logger.error(`Error al establecer ${key}`, error);
            return false;
        }
    }

    /**
     * Elimina un valor del almacenamiento
     */
    async delete(key) {
        try {
            localStorage.removeItem(key);
            this.logger.debug(`Valor eliminado: ${key}`);
            return true;
        } catch (error) {
            this.logger.error(`Error al eliminar ${key}`, error);
            return false;
        }
    }

    /**
     * Limpia todo el almacenamiento
     */
    async clear() {
        try {
            localStorage.clear();
            this.logger.info('Almacenamiento limpiado');
            return true;
        } catch (error) {
            this.logger.error('Error al limpiar almacenamiento', error);
            return false;
        }
    }

    /**
     * Obtiene la configuración de búsqueda
     */
    async getSearchConfig() {
        try {
            const config = await this.get('searchConfig');
            this.logger.debug('Obteniendo configuración:', config);
            return config || this.defaultConfig;
        } catch (error) {
            this.logger.error('Error al obtener configuración', error);
            return this.defaultConfig;
        }
    }

    /**
     * Guarda la configuración de búsqueda
     */
    async saveSearchConfig(config) {
        try {
            await this.set('searchConfig', config);
            this.logger.info('Configuración guardada');
            return true;
        } catch (error) {
            this.logger.error('Error al guardar configuración', error);
            return false;
        }
    }
}

// Exportar instancia global
window.storageService = new StorageService(); 