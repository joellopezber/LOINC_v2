import { websocketService } from '/static/js/services/websocket.service.js';

/**
 * Clase base para todos los testers
 * Maneja la conexión WebSocket y funcionalidad común
 */
export class BaseTester {
    constructor() {
        console.log('🔄 Inicializando BaseTester');
        this.isConnected = false;
        this.onConnectionChange = null;
        this.onError = null;
        // Exponer websocketService para las clases hijas
        this._ws = websocketService;
    }

    async connect() {
        try {
            if (websocketService.isConnected()) {
                console.log('🔌 Ya conectado al servidor');
                this.isConnected = true;
                this.onConnectionChange?.(true);
                // Solo llamar a initialize si está implementado
                if (this.initialize !== BaseTester.prototype.initialize) {
                    await this.initialize();
                }
                return;
            }

            console.log('🔌 Conectando al servidor...');

            // Configurar handlers de conexión
            websocketService.on('connected', async () => {
                console.log('✅ Conectado al servidor');
                this.isConnected = true;
                this.onConnectionChange?.(true);
                // Solo llamar a initialize si está implementado
                if (this.initialize !== BaseTester.prototype.initialize) {
                    await this.initialize();
                }
            });

            websocketService.on('disconnected', () => {
                console.log('❌ Desconectado del servidor');
                this.isConnected = false;
                this.onConnectionChange?.(false);
            });

            websocketService.on('error', (error) => {
                console.error('❌ Error de conexión:', error);
                this.isConnected = false;
                this.onConnectionChange?.(false);
                this.onError?.(error);
            });

            // Conectar usando websocketService
            await websocketService.connect();

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
        this.isConnected = false;
        // No desconectamos websocketService ya que puede estar siendo usado por otros servicios
    }

    // Método helper para logs
    log(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        console[isError ? 'error' : 'log'](`[${timestamp}] ${message}`);
    }
} 