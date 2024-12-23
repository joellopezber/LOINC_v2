import { encryption } from './encryption.js';

// Configuración por defecto
const defaultConfig = {
    search: {
        ontologyMode: 'multi_match',
        dbMode: 'sql',
        openai: {
            useOriginalTerm: true,
            useEnglishTerm: false,
            useRelatedTerms: false,
            useTestTypes: false,
            useLoincCodes: false,
            useKeywords: false
        }
    },
    sql: {
        maxTotal: 150,
        maxPerKeyword: 100,
        maxKeywords: 10,
        strictMode: true,
        sqlMaxTotal: 150
    },
    elastic: {
        limits: {
            maxTotal: 50,
            maxPerKeyword: 10
        },
        searchTypes: {
            exact: {
                enabled: true,
                priority: 10
            },
            fuzzy: {
                enabled: true,
                tolerance: 2
            },
            smart: {
                enabled: true,
                precision: 7
            }
        },
        showAdvanced: false
    }
};

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
        maxTotal: { type: 'number', min: 1, max: 1000 },
        maxPerKeyword: { type: 'number', min: 1, max: 100 },
        maxKeywords: { type: 'number', min: 1, max: 50 },
        strictMode: 'boolean',
        sqlMaxTotal: { type: 'number', min: 1, max: 1000, optional: true }
    },
    elastic: {
        limits: {
            maxTotal: { type: 'number', min: 1, max: 1000 },
            maxPerKeyword: { type: 'number', min: 1, max: 100 }
        },
        searchTypes: {
            exact: {
                enabled: 'boolean',
                priority: { type: 'number', min: 1, max: 100 }
            },
            fuzzy: {
                enabled: 'boolean',
                tolerance: { type: 'number', min: 1, max: 10 }
            },
            smart: {
                enabled: 'boolean',
                precision: { type: 'number', min: 1, max: 10 }
            }
        },
        showAdvanced: 'boolean'
    }
};

class StorageService {
    constructor() {
        console.info('[Storage] Inicializando servicio');
        if (!localStorage.getItem('installTimestamp')) {
            localStorage.setItem('installTimestamp', Date.now().toString());
        }
        this.initialize();
    }

    async initialize() {
        try {
            const existingConfig = localStorage.getItem('searchConfig');
            
            if (!existingConfig) {
                console.info('[Storage] Primera inicialización, usando valores por defecto');
                await this.setConfig(defaultConfig);
            } else {
                const parsedConfig = JSON.parse(existingConfig);
                if (!this.validateConfig(parsedConfig)) {
                    console.warn('[Storage] Configuración inválida, restaurando valores por defecto');
                    await this.setConfig(defaultConfig);
                }
            }
        } catch (error) {
            console.error('[Storage] Error en inicialización:', error);
            return defaultConfig;
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
        try {
            const config = localStorage.getItem('searchConfig');
            console.log('Obteniendo configuración:', config);
            return config ? JSON.parse(config) : defaultConfig;
        } catch (error) {
            console.error('Error al leer la configuración:', error);
            return defaultConfig;
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
            console.log('Configuración guardada:', config);

            // Emitir evento para que storage.service.js lo capture
            const event = new CustomEvent('storage:config_updated', { detail: config });
            window.dispatchEvent(event);

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
            
            if (!this.validateConfig(defaultConfig)) {
                console.error('[Storage] defaultConfig no es válido según el schema');
                throw new Error('defaultConfig no es válido');
            }
            
            localStorage.setItem('searchConfig', JSON.stringify(defaultConfig));
            document.dispatchEvent(new CustomEvent('config:updated', { 
                detail: { config: defaultConfig }
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