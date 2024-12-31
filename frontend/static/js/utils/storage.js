import { DEFAULT_CONFIG } from '../config/default-config.js';

// Esquema de validación
const configSchema = {
    search: {
        ontologyMode: ['multi_match', 'openai'],
        dbMode: ['sql', 'elastic'],
        openai: {
            useOriginalTerm: 'boolean',
            useEnglishTerm: 'boolean',
            useRelatedTerms: 'boolean',
            useTestTypes: 'boolean',
            useLoincCodes: 'boolean',
            useKeywords: 'boolean'
        }
    },
    sql: {
        maxTotal: 'number',
        maxPerKeyword: 'number',
        maxKeywords: 'number',
        strictMode: 'boolean'
    },
    elastic: {
        limits: {
            maxTotal: 'number',
            maxPerKeyword: 'number'
        },
        searchTypes: {
            exact: {
                enabled: 'boolean',
                priority: 'number'
            },
            fuzzy: {
                enabled: 'boolean',
                tolerance: 'number'
            },
            smart: {
                enabled: 'boolean',
                precision: 'number'
            }
        },
        showAdvanced: 'boolean'
    },
    performance: {
        maxCacheSize: 'number',
        cacheExpiry: 'number'
    }
};

class LocalStorage {
    constructor() {
        console.debug('[LocalStorage] Creando instancia...');
        this.initialized = false;
        
        // Asegurar que installTimestamp existe
        if (!localStorage.getItem('installTimestamp')) {
            localStorage.setItem('installTimestamp', Date.now().toString());
        }
    }

    /**
     * Inicializa el almacenamiento local
     */
    async initialize() {
        if (this.initialized) {
            console.debug('[LocalStorage] Ya inicializado, omitiendo...');
            return true;
        }

        try {
            console.debug('[LocalStorage] Iniciando...');
            await this._loadConfig();
            this.initialized = true;
            console.debug('[LocalStorage] ✅ Inicializado correctamente');
            return true;
        } catch (error) {
            console.error('[LocalStorage] Error en inicialización:', error);
            return false;
        }
    }

    /**
     * Obtiene un valor del localStorage
     */
    get(key) {
        try {
            const value = localStorage.getItem(key);
            if (!value) return null;

            // Si es una API key, devolver el valor encriptado sin parsear
            if (key.endsWith('ApiKey')) {
                return value;
            }

            // Para el resto de valores, parsear JSON
            return JSON.parse(value);
        } catch (error) {
            console.error(`[LocalStorage] Error obteniendo ${key}:`, error);
            return null;
        }
    }

    /**
     * Guarda un valor en localStorage
     */
    set(key, value) {
        try {
            // Si es una API key, guardar el valor encriptado directamente
            if (key.endsWith('ApiKey')) {
                localStorage.setItem(key, value);
            } else {
                // Para el resto de valores, convertir a JSON
                localStorage.setItem(key, JSON.stringify(value));
            }
            return true;
        } catch (error) {
            console.error(`[LocalStorage] Error guardando ${key}:`, error);
            return false;
        }
    }

    /**
     * Elimina un valor del localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`[LocalStorage] Error eliminando ${key}:`, error);
            return false;
        }
    }

    /**
     * Obtiene la configuración
     */
    async getConfig() {
        return this.get('searchConfig') || DEFAULT_CONFIG;
    }

    /**
     * Guarda la configuración
     */
    async setConfig(config) {
        if (!this.validateConfig(config)) {
            throw new Error('Configuración inválida');
        }
        return this.set('searchConfig', config);
    }

    /**
     * Carga la configuración inicial
     */
    async _loadConfig() {
        const config = await this.getConfig();
        if (!this.validateConfig(config)) {
            console.warn('[LocalStorage] Configuración inválida, restaurando valores por defecto');
            await this.setConfig(DEFAULT_CONFIG);
            return DEFAULT_CONFIG;
        }
        return config;
    }

    // Mantener los métodos de validación existentes
    validateConfigValue(value, schema) {
        try {
            if ((value === undefined || value === null) && typeof schema === 'object') {
                if (schema.optional) return true;
                console.warn('[LocalStorage] Valor requerido no encontrado para schema:', schema);
                return false;
            }

            if (typeof schema === 'string') {
                // Validación de tipos básicos
                switch (schema) {
                    case 'boolean':
                        const isBoolean = typeof value === 'boolean';
                        if (!isBoolean) console.error('Se esperaba boolean, se recibió:', typeof value);
                        return isBoolean;
                    case 'string':
                        const isString = typeof value === 'string';
                        if (!isString) console.error('Se esperaba string, se recibió:', typeof value);
                        return isString;
                    case 'number':
                        const isNumber = typeof value === 'number' && !isNaN(value);
                        if (!isNumber) console.error('Se esperaba number, se recibió:', typeof value);
                        return isNumber;
                    default:
                        console.error('Tipo de schema no reconocido:', schema);
                        return false;
                }
            } else if (Array.isArray(schema)) {
                // Validación de enums
                const isValid = schema.includes(value);
                if (!isValid) console.error('Valor no permitido en enum:', value, 'valores permitidos:', schema);
                return isValid;
            } else if (typeof schema === 'object') {
                // Si el schema tiene type, es una validación de número con rango
                if (schema.type === 'number') {
                    // Si es opcional y no tiene valor, es válido
                    if (schema.optional && (value === undefined || value === null)) {
                        return true;
                    }
                    const isValidNumber = typeof value === 'number' && 
                                        !isNaN(value) && 
                                        value >= schema.min && 
                                        value <= schema.max;
                    if (!isValidNumber) {
                        console.error('Número fuera de rango:', value, 'rango permitido:', schema.min, '-', schema.max);
                    }
                    return isValidNumber;
                }

                // Validación recursiva de objetos
                if (!value || typeof value !== 'object') {
                    console.error('Se esperaba un objeto, se recibió:', typeof value);
                    return false;
                }

                // Verificar que todas las propiedades requeridas existan
                for (const key of Object.keys(schema)) {
                    if (!schema[key].optional && !value.hasOwnProperty(key)) {
                        console.error('Propiedad requerida faltante:', key);
                        return false;
                    }
                }

                // Permitir propiedades adicionales que no estén en el schema
                return Object.keys(schema).every(key => {
                    if (!value.hasOwnProperty(key) && schema[key].optional) {
                        return true;
                    }
                    const isValid = this.validateConfigValue(value[key], schema[key]);
                    if (!isValid) {
                        console.error('Validación fallida para la propiedad:', key);
                    }
                    return isValid;
                });
            }
            return false;
        } catch (error) {
            console.error('[LocalStorage] Error en validación de valor:', error);
            return false;
        }
    }

    validateConfig(config) {
        try {
            const isValid = this.validateConfigValue(config, configSchema);
            if (!isValid) {
                console.warn('[LocalStorage] Configuración no cumple con el schema');
            }
            return isValid;
        } catch (error) {
            console.error('[LocalStorage] Error en validación de configuración:', error);
            return false;
        }
    }

    /**
     * Crea un backup de la configuración
     */
    async createBackup() {
        try {
            const config = await this.getConfig();
            const backup = {
                timestamp: Date.now(),
                config: config
            };
            this.set('configBackup', backup);
            return true;
        } catch (error) {
            console.error('[LocalStorage] Error al crear backup:', error);
            return false;
        }
    }

    /**
     * Restaura desde backup
     */
    async restoreFromBackup() {
        try {
            const backup = this.get('configBackup');
            if (backup?.config) {
                await this.setConfig(backup.config);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[LocalStorage] Error al restaurar backup:', error);
            return false;
        }
    }
}

// Exportar una instancia única
export const storage = new LocalStorage(); 