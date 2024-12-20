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
            useKeywords: false
        }
    },
    sql: {
        maxTotal: 150,
        maxPerKeyword: 100,
        maxKeywords: 10,
        strictMode: true
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

class StorageService {
    constructor() {
        console.log('Inicializando StorageService');
        this.initialize();
    }

    initialize() {
        try {
            const existingConfig = localStorage.getItem('searchConfig');
            console.log('Configuración existente:', existingConfig);
            
            if (!existingConfig) {
                console.log('No hay configuración, usando valores por defecto');
                this.setConfig(defaultConfig);
            } else {
                try {
                    const parsedConfig = JSON.parse(existingConfig);
                    console.log('Configuración cargada:', parsedConfig);
                    // Verificar si la configuración tiene todos los campos necesarios
                    if (!this.validateConfig(parsedConfig)) {
                        console.log('Configuración incompleta, usando valores por defecto');
                        this.setConfig(defaultConfig);
                    }
                } catch (error) {
                    console.error('Error al parsear configuración:', error);
                    this.setConfig(defaultConfig);
                }
            }
        } catch (error) {
            console.error('Error al inicializar storage:', error);
            return defaultConfig;
        }
    }

    validateConfig(config) {
        // Verificar campos principales
        const requiredFields = ['search', 'sql', 'elastic'];
        return requiredFields.every(field => config.hasOwnProperty(field));
    }

    getConfig() {
        try {
            const config = localStorage.getItem('searchConfig');
            console.log('Obteniendo configuración:', config);
            return config ? JSON.parse(config) : defaultConfig;
        } catch (error) {
            console.error('Error al leer la configuración:', error);
            return defaultConfig;
        }
    }

    setConfig(config) {
        try {
            console.log('Guardando configuración:', config);
            localStorage.setItem('searchConfig', JSON.stringify(config));
            document.dispatchEvent(new CustomEvent('config:updated', { detail: config }));
        } catch (error) {
            console.error('Error al guardar la configuración:', error);
        }
    }

    resetConfig() {
        console.log('Reseteando configuración a valores por defecto');
        this.setConfig(defaultConfig);
    }

    getItem(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch {
            return localStorage.getItem(key);
        }
    }

    setItem(key, value) {
        try {
            localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
        } catch (error) {
            console.error('Error al guardar en localStorage:', error);
        }
    }

    removeItem(key) {
        localStorage.removeItem(key);
    }

    clear() {
        localStorage.clear();
        this.initialize();
    }
}

export const storage = new StorageService(); 