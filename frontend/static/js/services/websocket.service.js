/**
 * Servicio para gestionar la conexión WebSocket con el backend
 */
class WebSocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.queue = [];
        this.retryCount = 0;
        this.maxRetries = 3;
        this.storageSchema = {
            version: "1.0",
            keys: {}
        };
    }

    /**
     * Inicia la conexión WebSocket
     */
    connect() {
        this.socket = io('http://localhost:3000');
        this.setupListeners();
        this.registerSchema();
    }

    /**
     * Configura los listeners de eventos WebSocket
     */
    setupListeners() {
        this.socket.on('connect', () => {
            console.log('WebSocket conectado');
            this.connected = true;
            this.processQueue();
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket desconectado');
            this.connected = false;
        });

        this.socket.on('storage.synced', (data) => {
            console.log('Sincronizado:', data.key);
        });

        this.socket.on('storage.error', (data) => {
            console.error('Error:', data.error);
        });

        this.socket.on('storage.schema_registered', (data) => {
            console.log('Schema registrado:', data.message);
        });
        
        // Nuevo listener para solicitudes del backend
        this.socket.on('storage.request_value', async (data) => {
            try {
                const { request_id, key } = data;
                
                // Obtener valor del localStorage
                const value = localStorage.getItem(key);
                
                // Enviar respuesta al backend
                this.socket.emit('storage.value_response', {
                    request_id,
                    key,
                    value,
                    status: 'success'
                });
            } catch (error) {
                console.error('Error procesando solicitud:', error);
                this.socket.emit('storage.value_response', {
                    request_id: data.request_id,
                    key: data.key,
                    error: error.message,
                    status: 'error'
                });
            }
        });
    }

    /**
     * Registra el schema del localStorage en el backend
     */
    registerSchema() {
        // Ejemplo de schema
        this.storageSchema.keys = {
            openaiApiKey: {
                type: "string",
                encrypted: true,
                required: true
            },
            anthropicApiKey: {
                type: "string",
                encrypted: true,
                required: true
            },
            googleApiKey: {
                type: "string",
                encrypted: true,
                required: true
            },
            theme: {
                type: "object",
                encrypted: false,
                required: false
            },
            preferences: {
                type: "object",
                encrypted: false,
                required: false
            }
        };

        if (this.connected) {
            this.socket.emit('storage.register_schema', this.storageSchema);
        } else {
            this.queue.push(['storage.register_schema', this.storageSchema]);
        }
    }

    /**
     * Sincroniza un valor con el backend
     */
    syncValue(key, value, encrypted = false) {
        const data = { key, value, encrypted };
        if (this.connected) {
            this.socket.emit('storage.sync', data);
        } else {
            this.queue.push(['storage.sync', data]);
            this.reconnect();
        }
    }

    /**
     * Procesa la cola de mensajes pendientes
     */
    processQueue() {
        while (this.queue.length > 0) {
            const [event, data] = this.queue.shift();
            this.socket.emit(event, data);
        }
    }

    /**
     * Intenta reconectar el WebSocket
     */
    reconnect() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            setTimeout(() => this.connect(), 1000 * this.retryCount);
        }
    }
}

// Exportar instancia global
window.webSocketService = new WebSocketService(); 