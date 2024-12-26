export class OntologyTester {
    constructor() {
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

        console.log('🔌 Conectando al servidor...');
        this.socket = io('http://localhost:5001', {
            transports: ['websocket']
        });

        this.socket.on('connect', () => {
            console.log('✅ Conectado al servidor');
            this.isConnected = true;
            this.onConnectionChange?.(true);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Desconectado del servidor');
            this.isConnected = false;
            this.onConnectionChange?.(false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Error de conexión:', error);
            this.isConnected = false;
            this.onConnectionChange?.(false);
        });
    }

    async search(query) {
        if (!this.socket?.connected) {
            throw new Error('No hay conexión con el servidor');
        }

        console.log('🔍 Buscando:', query);

        return new Promise((resolve, reject) => {
            this.socket.emit('ontology.search', { text: query }, (response) => {
                console.log('📩 Respuesta recibida:', response);

                if (response.status === 'success') {
                    this.onSearchResult?.(response);
                    resolve(response);
                } else {
                    const error = new Error(response.message || 'Error desconocido');
                    this.onError?.(error);
                    reject(error);
                }
            });
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
} 