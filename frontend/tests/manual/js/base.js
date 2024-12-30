/**
 * Clase base para todos los testers
 * Maneja la conexión WebSocket y funcionalidad común
 */
export class BaseTester {
    constructor() {
        console.log('🔄 Inicializando BaseTester');
        this.socket = null;
        this.isConnected = false;
        this.onConnectionChange = null;
        this.onError = null;
    }

    async connect() {
        try {
            if (this.socket?.connected) {
                console.log('🔌 Ya conectado al servidor');
                return;
            }

            console.log('🔌 Conectando al servidor...');
            this.socket = io('http://localhost:5001', {
                transports: ['websocket']
            });

            // Asignar socket a window para que otros servicios lo usen
            window.socket = this.socket;

            this.socket.on('connect', () => {
                console.log('✅ Conectado al servidor');
                this.isConnected = true;
                this.onConnectionChange?.(true);
                // Solo llamar a initialize si está implementado
                if (this.initialize !== BaseTester.prototype.initialize) {
                    this.initialize();
                }
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
                this.onError?.(error);
            });

        } catch (error) {
            console.error('❌ Error estableciendo conexión:', error);
            this.onError?.(error);
        }
    }

    // Método opcional que pueden implementar las clases hijas
    async initialize() {
        // Implementación por defecto vacía
        console.log('ℹ️ Usando implementación base de initialize()');
    }

    disconnect() {
        console.log('🧹 BaseTester: Limpiando recursos');
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
    }

    // Método helper para logs
    log(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        console[isError ? 'error' : 'log'](`[${timestamp}] ${message}`);
    }
} 