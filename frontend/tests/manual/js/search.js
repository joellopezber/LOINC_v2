export class SearchTester {
    constructor() {
        console.log('🏗️ Inicializando SearchTester');
        this.socket = null;
        this.isConnected = false;
        this.onConnectionChange = null;
        this.onSearchResult = null;
        this.onError = null;
    }

    async connect() {
        if (this.socket?.connected) {
            console.log('🔌 Ya conectado al servidor');
            return;
        }

        console.log('🔌 Conectando al servidor en http://localhost:5001...');
        try {
            this.socket = io('http://localhost:5001', {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });
            console.log('🔄 Socket configurado:', this.socket);
        } catch (error) {
            console.error('❌ Error al crear socket:', error);
        }

        this.socket.on('connect', () => {
            console.log('✅ Conectado al servidor');
            console.log('📡 ID de socket:', this.socket.id);
            this.isConnected = true;
            this.onConnectionChange?.(true);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Desconectado del servidor. Razón:', reason);
            this.isConnected = false;
            this.onConnectionChange?.(false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Error de conexión:', error.message);
            console.error('Stack:', error.stack);
            this.isConnected = false;
            this.onConnectionChange?.(false);
        });

        this.socket.on('search_result', (data) => {
            console.log('📩 Resultado de búsqueda recibido:', {
                timestamp: new Date().toISOString(),
                data: JSON.stringify(data, null, 2)
            });
            this.onSearchResult?.(data);
        });

        this.socket.on('error', (error) => {
            console.error('❌ Error del servidor:', {
                timestamp: new Date().toISOString(),
                message: error.message,
                details: error
            });
            this.onError?.(error);
        });

        // Monitorizar todos los eventos
        this.socket.onAny((eventName, ...args) => {
            console.log('🎯 Evento recibido:', {
                timestamp: new Date().toISOString(),
                event: eventName,
                args: args
            });
        });
    }

    async search(query) {
        if (!this.socket?.connected) {
            console.error('❌ Intento de búsqueda sin conexión');
            throw new Error('No hay conexión con el servidor');
        }

        const searchData = {
            query,
            user_id: this.socket.id,
            timestamp: new Date().toISOString()
        };

        console.log('🔍 Iniciando búsqueda:', searchData);

        return new Promise((resolve, reject) => {
            console.log('📤 Emitiendo evento search');
            this.socket.emit('search', searchData, (response) => {
                console.log('📩 Respuesta recibida:', {
                    timestamp: new Date().toISOString(),
                    status: response?.status,
                    response: JSON.stringify(response, null, 2)
                });

                if (response?.status === 'success') {
                    console.log('✅ Búsqueda exitosa');
                    this.onSearchResult?.(response);
                    resolve(response);
                } else {
                    console.error('❌ Error en búsqueda:', response?.message || 'Error desconocido');
                    const error = new Error(response?.message || 'Error desconocido');
                    this.onError?.(error);
                    reject(error);
                }
            });
        });
    }

    setPreferredService(service) {
        if (!this.socket?.connected) {
            console.error('❌ Intento de configuración sin conexión');
            throw new Error('No hay conexión con el servidor');
        }

        console.log('⚙️ Configurando servicio:', {
            timestamp: new Date().toISOString(),
            service: service,
            socketId: this.socket.id
        });

        return new Promise((resolve, reject) => {
            console.log('📤 Emitiendo evento set_preferred_service');
            this.socket.emit('set_preferred_service', { service }, (response) => {
                console.log('📩 Respuesta de configuración:', {
                    timestamp: new Date().toISOString(),
                    status: response?.status,
                    response: JSON.stringify(response, null, 2)
                });

                if (response?.status === 'success') {
                    console.log('✅ Configuración exitosa');
                    resolve(response);
                } else {
                    console.error('❌ Error en configuración:', response?.message || 'Error al configurar servicio');
                    const error = new Error(response?.message || 'Error al configurar servicio');
                    this.onError?.(error);
                    reject(error);
                }
            });
        });
    }

    disconnect() {
        if (this.socket) {
            console.log('👋 Desconectando socket:', {
                timestamp: new Date().toISOString(),
                socketId: this.socket.id,
                wasConnected: this.socket.connected
            });
            this.socket.disconnect();
            this.socket = null;
        }
    }
} 