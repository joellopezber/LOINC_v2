/**
 * Servicio para gestionar la conexión WebSocket con el backend
 */
class WebSocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Inicia la conexión WebSocket
     */
    connect() {
        const options = {
            transports: ['websocket'],
            upgrade: false,
            reconnection: true,
            reconnectionAttempts: this.maxRetries,
            reconnectionDelay: 1000
        };
        
        this.socket = io('http://localhost:5001', options);
        this.setupListeners();
    }

    /**
     * Configura los listeners de eventos WebSocket
     */
    setupListeners() {
        this.socket.on('connect', () => {
            console.log('WebSocket conectado');
            this.connected = true;
            this.retryCount = 0;
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket desconectado');
            this.connected = false;
            this.reconnect();
        });

        // Listener para obtener valor del localStorage
        this.socket.on('storage.get_value', async (data) => {
            try {
                const { request_id, key } = data;
                const value = localStorage.getItem(key);
                
                this.socket.emit('storage.value', {
                    request_id,
                    key,
                    value: value ? JSON.parse(value) : null
                });
            } catch (error) {
                console.error('Error al obtener valor:', error);
            }
        });

        // Listener para establecer valor en localStorage
        this.socket.on('storage.set_value', (data) => {
            try {
                const { key, value } = data;
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error('Error al establecer valor:', error);
            }
        });

        // Listener para obtener tablas disponibles
        this.socket.on('storage.get_tables', () => {
            try {
                const tables = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    try {
                        const value = JSON.parse(localStorage.getItem(key));
                        if (typeof value === 'object') {
                            tables.push({
                                name: key,
                                size: new Blob([JSON.stringify(value)]).size,
                                entries: Object.keys(value).length
                            });
                        }
                    } catch (e) {
                        // No es una tabla JSON válida
                        continue;
                    }
                }
                
                this.socket.emit('storage.tables', { tables });
            } catch (error) {
                console.error('Error al obtener tablas:', error);
            }
        });
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