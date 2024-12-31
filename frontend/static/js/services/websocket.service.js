/**
 * Servicio para gestionar la conexión WebSocket con el backend
 */
class WebSocketService {
    static instance = null;

    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    constructor() {
        if (WebSocketService.instance) {
            return WebSocketService.instance;
        }
        this.socket = null;
        this.connected = false;
        this.connecting = false;
        this.pendingRequests = new Map();
        this.requestId = 0;
        this.eventHandlers = new Map();
        WebSocketService.instance = this;
    }

    /**
     * Registra un manejador de eventos
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }

    /**
     * Elimina un manejador de eventos
     */
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }
    }

    /**
     * Emite un evento a todos los manejadores registrados
     */
    _emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    /**
     * Inicia la conexión WebSocket
     */
    async connect() {
        if (this.isConnected()) {
            console.debug('🔌 Reutilizando conexión WebSocket existente');
            return this.socket;
        }

        if (this.connecting) {
            console.debug('🔌 Conexión en progreso...');
            return new Promise((resolve) => {
                this.once('connected', () => resolve(this.socket));
            });
        }

        try {
            this.connecting = true;
            console.debug('🔌 Creando nueva conexión WebSocket');
            
            this.socket = io({
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: Infinity
            });

            await new Promise((resolve, reject) => {
                this.socket.on('connect', () => {
                    this.connected = true;
                    console.debug('🔌 Conectado al servidor WebSocket');
                    this._setupEventHandlers();
                    this._emit('connected');
                    resolve(this.socket);
                });

                this.socket.on('connect_error', (error) => {
                    console.error('🔌 Error de conexión WebSocket:', error);
                    reject(error);
                });

                this.socket.on('disconnect', () => {
                    this.connected = false;
                    console.warn('🔌 Desconectado del servidor WebSocket');
                    this._emit('disconnected');
                });

                this.socket.on('reconnect', () => {
                    this.connected = true;
                    console.info('🔌 Reconectado al servidor WebSocket');
                    this._setupEventHandlers();
                    this._emit('reconnected');
                });
            });

            return this.socket;
        } catch (error) {
            console.error('🔌 Error estableciendo conexión WebSocket:', error);
            throw error;
        } finally {
            this.connecting = false;
        }
    }

    isConnected() {
        return this.socket && this.socket.connected && this.connected;
    }

    /**
     * Configura los manejadores de eventos básicos
     */
    _setupEventHandlers() {
        if (!this.socket) return;

        this.socket.removeAllListeners();

        // Eventos básicos
        this.socket.on('disconnect', (reason) => {
            console.log(`🔌 Desconectado del servidor (${reason})`);
            this.connected = false;
            this._emit('disconnected', reason);
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`🔄 Reconectado después de ${attemptNumber} intentos`);
            this.connected = true;
            this._emit('reconnected', attemptNumber);
        });

        // Manejar respuestas del servidor
        this.socket.on('storage.value_set', (response) => {
            const { request_id, status, error } = response;
            const request = this.pendingRequests.get(request_id);
            
            if (request) {
                clearTimeout(request.timeout);
                if (status === 'success') {
                    request.resolve(response);
                } else {
                    request.reject(new Error(error || 'Error desconocido'));
                }
                this.pendingRequests.delete(request_id);
            }
        });

        // Manejar actualizaciones de valores
        this.socket.on('storage.value_updated', (data) => {
            this._emit('value_updated', data);
        });

        // Manejar errores
        this.socket.on('error', (error) => {
            console.error('❌ Error en WebSocket:', error);
            this._emit('error', error);
        });
    }

    /**
     * Envía una petición al servidor
     */
    async sendRequest(event, data) {
        if (!this.connected) {
            throw new Error('WebSocket no conectado');
        }

        const requestId = `req_${this.requestId++}`;
        const install_id = localStorage.getItem('installTimestamp');

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Timeout esperando respuesta'));
            }, 5000);

            this.pendingRequests.set(requestId, { resolve, reject, timeout });
            
            // Incluir install_id en cada petición
            this.socket.emit(event, { 
                ...data, 
                request_id: requestId,
                install_id: install_id  // ✅ Nombre correcto del parámetro
            });
        });
    }

    /**
     * Cierra la conexión WebSocket
     */
    async disconnect() {
        if (this.socket?.connected) {
            this.socket.disconnect();
            this.socket = null;
            window.socket = null;
            this.connected = false;
            this._emit('disconnected', 'manual');
        }
    }
}

// Crear y exportar la instancia única
const websocketService = WebSocketService.getInstance();
export { websocketService };
window.webSocketService = websocketService; 