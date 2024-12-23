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

                this.socket.on('connect', () => {
                    console.log('🔌 Conectado al servidor WebSocket');
                    this.connected = true;
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    console.error('❌ Error de conexión:', error);
                    reject(error);
                });

                this.socket.on('storage.value', (data) => {
                    const requestId = data.request_id;
                    if (this.pendingRequests.has(requestId)) {
                        const { resolve } = this.pendingRequests.get(requestId);
                        resolve(data.value);
                        this.pendingRequests.delete(requestId);
                    }
                });

                this.socket.on('storage.tables_received', (data) => {
                    const requestId = data.request_id;
                    if (this.pendingRequests.has(requestId)) {
                        const { resolve } = this.pendingRequests.get(requestId);
                        resolve(data.tables);
                        this.pendingRequests.delete(requestId);
                    }
                });

                this.socket.on('storage.set_value', async (data) => {
                    const { key, value } = data;
                    try {
                        await localStorage.setItem(key, JSON.stringify(value));
                        this.socket.emit('storage.value_set', { 
                            status: 'success',
                            key
                        });
                    } catch (error) {
                        this.socket.emit('storage.value_set', { 
                            status: 'error',
                            key,
                            error: error.message
                        });
                    }
                });

                this.socket.on('storage.get_value', async (data) => {
                    const { key, request_id } = data;
                    try {
                        const value = JSON.parse(localStorage.getItem(key));
                        this.socket.emit('storage.value', {
                            request_id,
                            value
                        });
                    } catch (error) {
                        this.socket.emit('storage.value', {
                            request_id,
                            error: error.message
                        });
                    }
                });

                this.socket.on('storage.get_tables', () => {
                    const tables = Object.keys(localStorage);
                    this.socket.emit('storage.tables', {
                        tables
                    });
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
            this.connected = false;
        }
    }

    /**
     * Obtiene el valor de una clave almacenada en localStorage
     * @param {string} key - La clave del valor almacenado en localStorage
     * @returns {Promise<any>} - El valor almacenado en localStorage
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
     * @param {string} key - La clave del valor almacenado en localStorage
     * @param {any} value - El valor a almacenar en localStorage
     * @returns {Promise<void>} - Una promesa que se resuelve cuando el valor se almacena correctamente
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
     * @returns {Promise<Array<{name: string, size: number, entries: number}>>} - Un array de objetos que representan las tablas disponibles
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