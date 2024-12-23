/**
 * Servicio para gestionar la conexión WebSocket con el backend
 */
class WebSocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.pendingRequests = new Map();
        this.requestId = 0;
    }

    /**
     * Inicia la conexión WebSocket
     */
    async connect() {
        if (this.socket) {
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                this.socket = io('http://localhost:5001', {
                    transports: ['websocket']
                });

                // Exponer el socket globalmente
                window.socket = this.socket;

                this.socket.on('connect', () => {
                    console.log('🔌 Conectado al servidor WebSocket');
                    this.connected = true;
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    console.error('❌ Error de conexión:', error);
                    reject(error);
                });

                // Manejar respuesta de valor
                this.socket.on('storage_value', (data) => {
                    console.log('📦 Valor recibido:', data);
                    const requestId = data.request_id;
                    if (this.pendingRequests.has(requestId)) {
                        const { resolve } = this.pendingRequests.get(requestId);
                        resolve(data.value);
                        this.pendingRequests.delete(requestId);
                    }
                });

                // Manejar respuesta de tablas
                this.socket.on('storage_tables_received', (data) => {
                    console.log('📋 Tablas recibidas:', data);
                    const requestId = data.request_id;
                    if (this.pendingRequests.has(requestId)) {
                        const { resolve } = this.pendingRequests.get(requestId);
                        resolve(data.tables);
                        this.pendingRequests.delete(requestId);
                    }
                });

                // Manejar respuesta de set_value
                this.socket.on('storage.value_set', (data) => {
                    console.log('💾 Valor guardado:', data);
                    const requestId = data.request_id;
                    if (this.pendingRequests.has(requestId)) {
                        const { resolve } = this.pendingRequests.get(requestId);
                        resolve(data);
                        this.pendingRequests.delete(requestId);
                    }
                });

            } catch (error) {
                console.error('❌ Error inicializando WebSocket:', error);
                reject(error);
            }
        });
    }

    /**
     * Cierra la conexión WebSocket
     */
    async disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            window.socket = null;
            this.connected = false;
        }
    }

    /**
     * Obtiene el valor de una clave almacenada en localStorage
     */
    async getValue(key) {
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
            this.socket.emit('storage.get_value', { key, request_id: requestId });
        });
    }

    /**
     * Establece el valor de una clave almacenada en localStorage
     */
    async setValue(key, value) {
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
            this.socket.emit('storage.set_value', { key, value, request_id: requestId });
        });
    }

    /**
     * Obtiene las tablas disponibles almacenadas en localStorage
     */
    async getTables() {
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
            this.socket.emit('storage.get_tables', { request_id: requestId });
        });
    }
}

// Crear instancia global
const websocketService = new WebSocketService();

// Exportar como módulo y asignar a window
export { websocketService };
window.webSocketService = websocketService; 