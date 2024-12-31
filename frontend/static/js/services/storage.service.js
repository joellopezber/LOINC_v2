import { storage } from '../utils/storage.js';
import { websocketService } from './websocket.service.js';

// Clase para manejar el logging interno del servicio
class StorageLogger {
    constructor(prefix = '[StorageService]') {
        this.prefix = prefix;
    }

    debug(...args) { console.debug(this.prefix, ...args); }
    info(...args) { console.info(this.prefix, ...args); }
    warn(...args) { console.warn(this.prefix, ...args); }
    error(...args) { console.error(this.prefix, ...args); }
}

// Clase para manejar la caché interna
class StorageCache {
    constructor(logger) {
        this.logger = logger;
        this.cache = new Map();
        this.timeouts = new Map();
        this.defaultTTL = 1000; // 1 segundo por defecto
    }

    get(key) {
        if (this.cache.has(key)) {
            const now = Date.now();
            const { value, expiry } = this.cache.get(key);
            if (now < expiry) {
                return value;
            }
            this.cache.delete(key);
        }
        return null;
    }

    set(key, value, ttl = this.defaultTTL) {
        const expiry = Date.now() + ttl;
        this.cache.set(key, { value, expiry });
        
        // Limpiar caché anterior si existe
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
        }
        
        // Configurar limpieza automática
        const timeout = setTimeout(() => {
            this.cache.delete(key);
            this.timeouts.delete(key);
        }, ttl);
        
        this.timeouts.set(key, timeout);
    }

    clear(key) {
        if (key) {
            this.cache.delete(key);
            if (this.timeouts.has(key)) {
                clearTimeout(this.timeouts.get(key));
                this.timeouts.delete(key);
            }
        } else {
            this.cache.clear();
            this.timeouts.forEach(clearTimeout);
            this.timeouts.clear();
        }
    }
}

// Clase para manejar la validación
class StorageValidator {
    constructor(logger) {
        this.logger = logger;
        this.types = {
            'searchConfig': {
                sync: true,
                cache: true,
                validate: (value) => value && typeof value === 'object'
            },
            'ontologyResults': {
                sync: true,
                cache: true,
                validate: (value) => value && typeof value === 'object'
            },
            'openaiApiKey': {
                sync: true,
                encrypt: true,
                validate: (value) => typeof value === 'string'
            },
            'installTimestamp': {
                sync: true,
                cache: false,
                validate: (value) => typeof value === 'string'
            }
        };
    }

    isValidType(key) {
        return key in this.types;
    }

    validateValue(key, value) {
        if (!this.isValidType(key)) {
            this.logger.error('Tipo de almacenamiento no soportado:', key);
            return false;
        }

        const validator = this.types[key].validate;
        const isValid = validator(value);
        
        if (!isValid) {
            this.logger.error('Valor inválido para ' + key + ':', value);
        }
        
        return isValid;
    }

    shouldSync(key) {
        return this.types[key]?.sync || false;
    }

    shouldCache(key) {
        return this.types[key]?.cache || false;
    }
}

// Clase para manejar la sincronización
class StorageSync {
    constructor(logger) {
        this.logger = logger;
        this.queue = [];
        this.syncing = false;
    }

    async syncWithServer(data, options = {}) {
        try {
            if (this.syncing && !options.force) {
                this.queue.push({ data, options });
                return true;
            }

            this.syncing = true;
            
            // Enviar datos al servidor
            const installId = localStorage.getItem('installTimestamp');
            for (const [key, value] of Object.entries(data)) {
                await websocketService.sendRequest('storage.set_value', {
                    key,
                    value,
                    install_id: installId,
                    force: options.force
                });
            }

            // Procesar cola pendiente
            while (this.queue.length > 0) {
                const next = this.queue.shift();
                await this.syncWithServer(next.data, next.options);
            }

            return true;
        } catch (error) {
            this.logger.error('Error sincronizando:', error);
            return false;
        } finally {
            this.syncing = false;
        }
    }
}

// Clase principal del servicio
class StorageService {
    constructor() {
        // Inicializar componentes internos
        this.logger = new StorageLogger();
        this.cache = new StorageCache(this.logger);
        this.validator = new StorageValidator(this.logger);
        this.sync = new StorageSync(this.logger);

        // Estado del servicio
        this.initialized = false;
        this.initializing = false;

        // Configurar eventos WebSocket
        websocketService.on('connected', () => this._handleWebSocketConnect());
        websocketService.on('reconnected', () => this._handleWebSocketReconnect());
    }

    async initialize() {
        if (this.initialized) {
            this.logger.debug('Ya inicializado, omitiendo...');
            return true;
        }
        
        if (this.initializing) {
            this.logger.debug('Inicialización en progreso...');
            return false;
        }

        try {
            this.initializing = true;
            this.logger.debug('Iniciando servicio de almacenamiento...');
            
            // 1. Verificar storage base
            if (!storage.initialized) {
                await storage.initialize();
                this.logger.debug('Storage base inicializado');
            } else {
                this.logger.debug('Storage base ya estaba inicializado');
            }
            
            // 2. Verificar WebSocket
            if (!websocketService.isConnected()) {
                await websocketService.connect();
                this.logger.debug('WebSocket conectado');
            } else {
                this.logger.debug('WebSocket ya estaba conectado');
            }
            
            // 3. Sincronizar datos iniciales
            const localData = await this._getLocalData();
            await this.sync.syncWithServer(localData);
            this.logger.debug('Datos sincronizados');
            
            this.initialized = true;
            this.logger.info('Servicio de almacenamiento inicializado correctamente');
            return true;
        } catch (error) {
            this.logger.error('Error en inicialización:', error);
            return false;
        } finally {
            this.initializing = false;
        }
    }

    async get(key) {
        if (!this.validator.isValidType(key)) return null;

        // 1. Intentar obtener de caché
        if (this.validator.shouldCache(key)) {
            const cached = this.cache.get(key);
            if (cached !== null) return cached;
        }

        // 2. Obtener del storage
        const value = await storage.get(key);
        
        // 3. Actualizar caché si es necesario
        if (value !== null && this.validator.shouldCache(key)) {
            this.cache.set(key, value);
        }
        
        return value;
    }

    async set(key, value) {
        // 1. Validar
        if (!this.validator.validateValue(key, value)) return false;

        // 2. Guardar en storage
        const success = await storage.set(key, value);
        if (!success) return false;

        // 3. Actualizar caché
        if (this.validator.shouldCache(key)) {
            this.cache.set(key, value);
        }

        // 4. Sincronizar si es necesario
        if (this.validator.shouldSync(key)) {
            await this.sync.syncWithServer({ [key]: value });
        }

        return true;
    }

    async _getLocalData() {
        const data = {};
        for (const key of Object.keys(this.validator.types)) {
            // No incluir API keys en la sincronización inicial
            if (!key.endsWith('ApiKey')) {
                const value = await this.get(key);
                if (value !== null) {
                    data[key] = value;
                }
            }
        }
        return data;
    }

    async _handleWebSocketConnect() {
        if (!this.initialized) return;
        const localData = await this._getLocalData();
        await this.sync.syncWithServer(localData);
    }

    async _handleWebSocketReconnect() {
        if (!this.initialized) return;
        const localData = await this._getLocalData();
        await this.sync.syncWithServer(localData, { force: true });
    }
}

// Exportar instancia única
const storageService = new StorageService();
export { storageService };