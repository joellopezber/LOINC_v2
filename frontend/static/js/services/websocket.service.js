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
        this.pendingRequests = new Map();
        this.requestId = 0;
        WebSocketService.instance = this;
    }

    /**
     * Inicia la conexión WebSocket
     */
    async connect() {
        // Si ya hay una conexión activa, retornarla
        if (this.socket?.connected) {
            console.debug('🔌 Reutilizando conexión WebSocket existente');
            return this.socket;
        }

        return new Promise((resolve, reject) => {
            try {
                if (!this.socket) {
                    console.debug('🔌 Creando nueva conexión WebSocket');
                    this.socket = io('http://localhost:5001', {
                        transports: ['websocket'],
                        reconnection: true,
                        reconnectionAttempts: 10,
                        reconnectionDelay: 500,
                        timeout: 10000,
                        // Permitir reutilización de conexiones
                        multiplex: true,
                        // No forzar nueva conexión
                        forceNew: false,
                        autoConnect: false
                    });

                    window.socket = this.socket;
                    this.setupEventHandlers();
                    this.socket.connect();
                }

                // Timeout para la conexión
                const timeout = setTimeout(() => {
                    if (!this.socket.connected) {
                        console.warn('⚠️ Timeout en conexión - reintentando...');
                        this.socket.connect();
                    }
                }, 5000);

                this.socket.once('connect', () => {
                    clearTimeout(timeout);
                    console.log('🔌 Conectado al servidor WebSocket');
                    this.connected = true;
                    resolve(this.socket);
                });

                this.socket.once('connect_error', (error) => {
                    clearTimeout(timeout);
                    console.error('❌ Error de conexión:', error);
                    // No rechazar inmediatamente, permitir reintentos
                    if (!this.socket.connected) {
                        this.socket.connect();
                    }
                });

            } catch (error) {
                console.error('❌ Error inicializando WebSocket:', error);
                reject(error);
            }
        });
    }

    /**
     * Configura los manejadores de eventos
     */
    setupEventHandlers() {
        if (!this.socket) return;

        // Limpiar listeners anteriores
        this.socket.removeAllListeners();

        // Manejar respuesta de valor
        this.socket.on('storage_value', (data) => {
            console.debug('📦 Valor recibido:', this._formatLogValue(data));
            this.resolveRequest(data);
        });

        // Manejar respuesta de set_value
        this.socket.on('storage.value_set', (data) => {
            console.debug('💾 Valor guardado:', this._formatLogValue(data));
            this.resolveRequest(data);
        });

        // Manejar reconexión
        let reconnectAttempts = 0;
        
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            reconnectAttempts = attemptNumber;
            console.debug(`🔄 Intento de reconexión #${attemptNumber}`);
        });

        this.socket.on('reconnect', () => {
            console.log(`🔄 Reconectado después de ${reconnectAttempts} intentos`);
            this.connected = true;
            reconnectAttempts = 0;
            // Notificar reconexión exitosa
            window.dispatchEvent(new CustomEvent('websocket:reconnected'));
        });

        this.socket.on('disconnect', (reason) => {
            console.log(`🔌 Desconectado del servidor (${reason})`);
            this.connected = false;
            // Notificar desconexi��n
            window.dispatchEvent(new CustomEvent('websocket:disconnected'));
        });
    }

    /**
     * Formatea valores para logging
     */
    _formatLogValue(data) {
        if (!data) return data;
        
        // Crear copia para no modificar el original
        const logData = { ...data };
        
        // Ocultar valores sensibles
        if (logData.key === 'openaiApiKey') {
            logData.value = '********';
        }
        
        // Truncar valores largos
        if (typeof logData.value === 'string' && logData.value.length > 50) {
            logData.value = logData.value.substring(0, 50) + '...';
        }
        
        return logData;
    }

    /**
     * Resuelve una petición pendiente
     */
    resolveRequest(data) {
        const requestId = data.request_id;
        if (this.pendingRequests.has(requestId)) {
            const { resolve, timeout } = this.pendingRequests.get(requestId);
            clearTimeout(timeout);
            resolve(data);
            this.pendingRequests.delete(requestId);
        }
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
            console.log('🔌 Desconexión manual del WebSocket');
        }
    }

    /**
     * Obtiene el valor de una clave almacenada
     */
    async getValue(key) {
        return this.sendRequest('storage.get_value', { key });
    }

    /**
     * Establece el valor de una clave
     */
    async setValue(key, value) {
        return this.sendRequest('storage.set_value', { key, value });
    }

    /**
     * Envía una petición al servidor
     */
    async sendRequest(event, data) {
        if (!this.connected) {
            throw new Error('WebSocket no conectado');
        }

        const requestId = `req_${this.requestId++}`;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Timeout esperando respuesta'));
            }, 5000);

            this.pendingRequests.set(requestId, { resolve, reject, timeout });
            this.socket.emit(event, { ...data, request_id: requestId });
        });
    }
}

// Crear y exportar la instancia única
const websocketService = WebSocketService.getInstance();
export { websocketService };
window.webSocketService = websocketService; 