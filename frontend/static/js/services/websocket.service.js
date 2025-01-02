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
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        WebSocketService.instance = this;
        
        // Handlers para eventos de storage
        this.socket?.on('storage.value', (response) => {
            const { request_id, status, value, message } = response;
            const pending = this.pendingRequests.get(request_id);
            
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(request_id);
                
                if (status === 'success') {
                    pending.resolve({ status, value });
                } else {
                    pending.reject(new Error(message || 'Error desconocido'));
                }
            }
        });
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
            return this.socket;
        }

        if (this.connecting) {
            return new Promise((resolve) => {
                this.once('connected', () => resolve(this.socket));
            });
        }

        try {
            this.connecting = true;
            
            // Usar socket existente si está disponible
            if (window.socket?.connected) {
                this.socket = window.socket;
                this.connected = true;
                this._setupEventHandlers();
                this._emit('connected');
                return this.socket;
            }
            
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
                    this._setupEventHandlers();
                    this._emit('connected');
                    resolve(this.socket);
                });

                this.socket.on('connect_error', (error) => {
                    console.error('❌ Error de conexión:', error);
                    reject(error);
                });
            });

            return this.socket;
        } catch (error) {
            this.connecting = false;
            console.error('❌ Error:', error);
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
            this.connected = false;
            this._emit('disconnected', reason);
        });

        this.socket.on('reconnect', (attemptNumber) => {
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

        // Manejar respuesta de get_all_for_user
        this.socket.on('storage.all_data', (response) => {
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

        // Manejar respuesta de master key
        this.socket.on('encryption.master_key', (response) => {
            const { request_id, status, key, message } = response;
            
            if (!request_id) {
                console.error('❌ Error: respuesta sin request_id');
                return;
            }
            
            const request = this.pendingRequests.get(request_id);
            
            if (request) {
                clearTimeout(request.timeout);
                this.pendingRequests.delete(request_id);
                
                if (status === 'success' && key) {
                    request.resolve({ status, key });
                } else {
                    request.reject(new Error(message || 'Error obteniendo master key'));
                }
            }
        });

        // Manejar actualizaciones de valores
        this.socket.on('storage.value_updated', (data) => {
            this._emit('value_updated', data);
        });

        // Manejar errores
        this.socket.on('error', (error) => {
            console.error('❌ Error:', error);
            this._emit('error', error);
        });
    }

    /**
     * Envía una petición al servidor
     */
    async sendRequest(event, data) {
        if (window.socket?.connected && !this.socket) {
            this.socket = window.socket;
            this.connected = true;
            this._setupEventHandlers();
        }

        if (!this.connected) {
            console.error('❌ Error: WebSocket no conectado');
            throw new Error('WebSocket no conectado');
        }

        const requestId = `req_${this.requestId++}`;
        const install_id = localStorage.getItem('installTimestamp');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Timeout esperando respuesta'));
            }, event.startsWith('ontology.') ? 30000 : 5000);

            // Usar el evento de respuesta según el servicio
            let responseEvent;
            if (event === 'ontology.search') responseEvent = 'ontology.result';
            else if (event === 'openai.test_search') responseEvent = 'openai.test_result';
            else if (event === 'database.search') responseEvent = 'database.result';
            else responseEvent = event + '_result';
            
            this.socket.once(responseEvent, (response) => {
                if (response.request_id === requestId) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);

                    if (response.status === 'success') {
                        resolve(response);
                    } else {
                        reject(new Error(response.message || 'Error desconocido'));
                    }
                }
            });

            this.pendingRequests.set(requestId, { resolve, reject, timeout });
            
            this.socket.emit(event, { 
                ...data, 
                request_id: requestId,
                install_id: install_id
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