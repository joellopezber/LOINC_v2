import { storage } from '../utils/storage.js';
import { websocketService } from './websocket.service.js';

// Clase para manejar el logging interno del servicio
class StorageLogger {
    constructor(prefix = '[Storage]') {
        this.prefix = prefix;
    }

    debug(key, ...args) { 
        if (key === 'openaiApiKey') {
            console.debug(this.prefix, `${key}: [ENCRYPTED]`);
            return;
        }
        console.debug(this.prefix, `${key}:`, ...args); 
    }
    
    info(key, ...args) { 
        if (key === 'openaiApiKey') {
            console.info(this.prefix, `${key}: [ENCRYPTED]`);
            return;
        }
        console.info(this.prefix, `${key}:`, ...args); 
    }
    
    warn(key, ...args) { 
        console.warn(this.prefix, `${key}:`, ...args); 
    }
    
    error(key, ...args) { 
        console.error(this.prefix, `${key}:`, ...args); 
    }

    group(title) {
        console.group(this.prefix, title);
    }

    groupEnd() {
        console.groupEnd();
    }
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
                validate: (value) => typeof value === 'string' || typeof value === 'number'
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
        this.pendingSync = new Set();  // Nuevo: Set para trackear datos pendientes
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
                try {
                    await websocketService.sendRequest('storage.set_value', {
                        key,
                        value,
                        install_id: installId,
                        force: options.force
                    });
                    // Si se sincronizó correctamente, remover de pendientes
                    this.pendingSync.delete(key);
                } catch (error) {
                    // Si falla la sincronización, marcar como pendiente
                    this.pendingSync.add(key);
                    this.logger.warn(key, 'Error sincronizando, reintentará más tarde');
                }
            }

            // Procesar cola pendiente
            while (this.queue.length > 0) {
                const next = this.queue.shift();
                await this.syncWithServer(next.data, next.options);
            }

            return true;
        } catch (error) {
            this.logger.error('sync', error);
            // Marcar todos los datos como pendientes
            Object.keys(data).forEach(key => this.pendingSync.add(key));
            return false;
        } finally {
            this.syncing = false;
        }
    }

    hasPendingSync() {
        return this.pendingSync.size > 0;
    }

    getPendingKeys() {
        return Array.from(this.pendingSync);
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
            this.logger.debug('init', 'Ya inicializado');
            return true;
        }
        
        if (this.initializing) {
            this.logger.debug('init', 'En progreso');
            return false;
        }

        try {
            this.initializing = true;
            this.logger.group('Inicializando');
            
            // Inicializar servicios en paralelo
            const initPromises = [
                !storage.initialized ? storage.initialize() : Promise.resolve(true),
                !websocketService.isConnected() ? websocketService.connect() : Promise.resolve(true)
            ];

            const [storageOk, websocketOk] = await Promise.all(initPromises);
            
            if (!storageOk || !websocketOk) {
                throw new Error('Error inicializando servicios base');
            }
            
            // Sincronizar datos iniciales uno a uno
            const localData = await this._getLocalData();
            if (Object.keys(localData).length > 0) {
                this.logger.debug('sync', `Sincronizando ${Object.keys(localData).length} valores`);
                await this.sync.syncWithServer(localData);
            }
            
            this.initialized = true;
            this.logger.info('init', '✓ Inicializado');
            this.logger.groupEnd();
            return true;
        } catch (error) {
            this.logger.error('init', error);
            return false;
        } finally {
            this.initializing = false;
        }
    }

    async _getLocalData() {
        const data = {};
        for (const key of Object.keys(this.validator.types)) {
            const value = await this.get(key);
            if (value !== null) {
                data[key] = value;
            }
        }
        return data;
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

    async _handleWebSocketConnect() {
        if (!this.initialized) return;
        const localData = await this._getLocalData();
        await this.sync.syncWithServer(localData);
    }

    async _handleWebSocketReconnect() {
        if (!this.initialized) return;

        // Primero sincronizar datos pendientes
        if (this.sync.hasPendingSync()) {
            this.logger.info('Reintentando sincronizar datos pendientes...');
            const pendingData = {};
            for (const key of this.sync.getPendingKeys()) {
                const value = await this.get(key);
                if (value !== null) {
                    pendingData[key] = value;
                }
            }
            await this.sync.syncWithServer(pendingData, { force: true });
        }

        // Luego sincronizar todos los datos como respaldo
        const localData = await this._getLocalData();
        await this.sync.syncWithServer(localData, { force: true });
    }
}

// Exportar instancia única
const storageService = new StorageService();
export { storageService };