import { encryption } from './encryption.js';
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

class StorageService {
    constructor() {
        console.debug('[Storage] Creando instancia...');
        this.config = null;
        this.initialized = false;
        this.initPromise = null;
        this.logger = console;
        
        // Asegurar que installTimestamp existe
        if (!localStorage.getItem('installTimestamp')) {
            localStorage.setItem('installTimestamp', Date.now().toString());
        }
    }

    /**
     * Inicializa el almacenamiento
     */
    async initialize() {
        // Si ya hay una inicialización en curso, retornar la promesa existente
        if (this.initPromise) {
            console.debug('[Storage] Inicialización en curso...');
            return this.initPromise;
        }

        // Si ya está inicializado, retornar inmediatamente
        if (this.initialized) {
            console.debug('[Storage] Ya inicializado');
            return true;
        }

        this.initPromise = (async () => {
            try {
                console.debug('[Storage] Iniciando...');
                
                // Cargar configuración inicial
                await this._loadConfig();
                
                this.initialized = true;
                console.debug('[Storage] ✅ Inicializado');
                return true;
            } catch (error) {
                console.error('[Storage] Error en inicialización:', error);
                return false;
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    async _loadConfig() {
        try {
            const existingConfig = localStorage.getItem('searchConfig');
            
            if (!existingConfig) {
                console.debug('[Storage] Primera inicialización, usando valores por defecto');
                await this.setConfig(DEFAULT_CONFIG);
                return DEFAULT_CONFIG;
            }

            const parsedConfig = JSON.parse(existingConfig);
            if (!this.validateConfig(parsedConfig)) {
                console.warn('[Storage] Configuración inválida, restaurando valores por defecto');
                await this.setConfig(DEFAULT_CONFIG);
                return DEFAULT_CONFIG;
            }

            return parsedConfig;
        } catch (error) {
            console.error('[Storage] Error cargando configuración:', error);
            await this.setConfig(DEFAULT_CONFIG);
            return DEFAULT_CONFIG;
        }
    }

    validateConfigValue(value, schema) {
        try {
            if ((value === undefined || value === null) && typeof schema === 'object') {
                if (schema.optional) return true;
                console.warn('[Storage] Valor requerido no encontrado para schema:', schema);
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
            console.error('[Storage] Error en validación de valor:', error);
            return false;
        }
    }

    validateConfig(config) {
        try {
            const isValid = this.validateConfigValue(config, configSchema);
            if (!isValid) {
                console.warn('[Storage] Configuración no cumple con el schema');
            }
            return isValid;
        } catch (error) {
            console.error('[Storage] Error en validación de configuración:', error);
            return false;
        }
    }

    async getConfig() {
        // Asegurar que el servicio está inicializado
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const config = localStorage.getItem('searchConfig');
            console.debug('Obteniendo configuración:', config);
            return config ? JSON.parse(config) : DEFAULT_CONFIG;
        } catch (error) {
            console.error('Error al leer la configuración:', error);
            return DEFAULT_CONFIG;
        }
    }

    /**
     * Guarda la configuración en localStorage
     */
    async setConfig(config) {
        try {
            // Validar configuración
            if (!this.validateConfig(config)) {
                throw new Error('Configuración inválida');
            }

            // Guardar en localStorage
            localStorage.setItem('searchConfig', JSON.stringify(config));
            console.debug('Configuración guardada:', config);

            // Emitir evento para que storage.service.js lo capture
            window.dispatchEvent(new CustomEvent('storage:config_updated', { detail: config }));

            return true;
        } catch (error) {
            console.error('Error al guardar configuración:', error);
            throw error;
        }
    }

    async resetConfig() {
        try {
            console.info('[Storage] Reseteando a valores por defecto');
            
            await this.createBackup();
            
            if (!this.validateConfig(DEFAULT_CONFIG)) {
                console.error('[Storage] defaultConfig no es válido según el schema');
                throw new Error('defaultConfig no es válido');
            }
            
            localStorage.setItem('searchConfig', JSON.stringify(DEFAULT_CONFIG));
            document.dispatchEvent(new CustomEvent('config:updated', { 
                detail: { config: DEFAULT_CONFIG }
            }));
            
            return true;
        } catch (error) {
            console.error('[Storage] Error al resetear configuración:', error);
            throw error;
        }
    }

    // Backup
    async createBackup() {
        try {
            const config = await this.getConfig();
            const backup = {
                timestamp: Date.now(),
                config: config
            };
            localStorage.setItem('configBackup', JSON.stringify(backup));
        } catch (error) {
            console.error('[Storage] Error al crear backup:', error);
        }
    }

    async restoreFromBackup() {
        try {
            const backup = localStorage.getItem('configBackup');
            if (backup) {
                const { config } = JSON.parse(backup);
                await this.setConfig(config);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error al restaurar backup:', error);
            return false;
        }
    }
}

export const storage = new StorageService(); 