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
            
            // Usar socket existente si está disponible
            if (window.socket?.connected) {
                console.debug('🔌 Usando socket existente de window.socket');
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
                    console.debug('🔌 Conectado al servidor WebSocket');
                    this._setupEventHandlers();
                    this._emit('connected');
                    resolve(this.socket);
                });

                this.socket.on('connect_error', (error) => {
                    console.error('🔌 Error de conexión WebSocket:', error);
                    reject(error);
                });
            });

            return this.socket;
        } catch (error) {
            this.connecting = false;
            console.error('❌ Error estableciendo conexión WebSocket:', error);
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
        console.debug('🔄 Configurando handlers de WebSocket...');

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
            console.debug('📥 Recibido storage.value_set:', response);
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
            console.debug('📥 Recibido storage.all_data:', response);
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
            console.debug('📥 Recibido encryption.master_key:', { 
                ...response, 
                key: response.key ? '(presente)' : '(ausente)',
                request_id: response.request_id || 'undefined'
            });
            
            const { request_id, status, key, message } = response;
            
            if (!request_id) {
                console.error('❌ Error: respuesta sin request_id');
                return;
            }
            
            const request = this.pendingRequests.get(request_id);
            
            if (request) {
                console.debug(`✅ Encontrada solicitud pendiente para request_id: ${request_id}`);
                clearTimeout(request.timeout);
                this.pendingRequests.delete(request_id);
                
                if (status === 'success' && key) {
                    console.debug('✅ Master key recibida correctamente');
                    request.resolve({ status, key });
                } else {
                    console.error('❌ Error en respuesta de master key:', message);
                    request.reject(new Error(message || 'Error obteniendo master key'));
                }
            } else {
                console.warn(`⚠️ No se encontró solicitud pendiente para request_id: ${request_id}`);
                console.debug('Solicitudes pendientes:', Array.from(this.pendingRequests.keys()));
            }
        });

        // Manejar actualizaciones de valores
        this.socket.on('storage.value_updated', (data) => {
            console.debug('📥 Recibido storage.value_updated:', data);
            this._emit('value_updated', data);
        });

        // Manejar errores
        this.socket.on('error', (error) => {
            console.error('❌ Error en WebSocket:', error);
            this._emit('error', error);
        });

        console.debug('✅ Handlers de WebSocket configurados');
    }

    /**
     * Envía una petición al servidor
     */
    async sendRequest(event, data) {
        // Si hay un socket en window, usarlo
        if (window.socket?.connected && !this.socket) {
            console.debug('🔌 Usando socket existente de window.socket');
            this.socket = window.socket;
            this.connected = true;
            this._setupEventHandlers();
        }

        if (!this.connected) {
            console.error('❌ WebSocket no conectado');
            throw new Error('WebSocket no conectado');
        }

        const requestId = `req_${this.requestId++}`;
        const install_id = localStorage.getItem('installTimestamp');

        console.debug(`🔄 Preparando request ${requestId} para evento ${event}`);
        console.debug('📤 Datos a enviar:', { ...data, install_id, request_id: requestId });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn(`⏰ Timeout para evento ${event} (request_id: ${requestId})`);
                this.pendingRequests.delete(requestId);
                reject(new Error('Timeout esperando respuesta'));
            }, event.startsWith('ontology.') ? 30000 : 5000);

            // Registrar handlers para la respuesta
            this.socket.once(event + '_result', (response) => {
                console.debug(`📩 Respuesta recibida para ${event} (request_id: ${requestId}):`, response);
                
                if (response.request_id === requestId) {
                    console.debug('✅ Request ID coincide, procesando respuesta');
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    
                    if (response.status === 'success') {
                        resolve(response);
                    } else {
                        reject(new Error(response.message || 'Error desconocido'));
                    }
                } else {
                    console.warn('⚠️ Request ID no coincide, ignorando respuesta');
                }
            });

            console.debug(`📤 Enviando ${event} (request_id: ${requestId})`, data);
            this.pendingRequests.set(requestId, { resolve, reject, timeout });
            
            // Incluir install_id en cada petición
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