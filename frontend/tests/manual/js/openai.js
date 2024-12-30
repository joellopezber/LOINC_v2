export class OpenAITester {
    constructor() {
        this.socket = null;
        this.messages = [];
        this.systemPrompt = null;
        this.isConnected = false;
        this.onConnectionChange = null;
        this.onMessageReceived = null;
        this.onTypingStart = null;
        this.onTypingEnd = null;
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

        // Escuchar respuestas de OpenAI
        this.socket.on('openai.test_result', (response) => {
            console.log('📩 Respuesta recibida:', response);
            this.onTypingEnd?.();

            if (response.status === 'success') {
                // Añadir respuesta al historial
                this.messages.push({
                    role: 'assistant',
                    content: response.response
                });
                this.onMessageReceived?.(response.response, false);
            } else {
                console.error('❌ Error:', response.message || 'Error desconocido');
            }
        });
    }

    async sendMessage(message) {
        if (!this.socket?.connected) {
            throw new Error('No hay conexión con el servidor');
        }

        console.log('📤 Enviando mensaje:', message);
        this.onTypingStart?.();

        // Añadir mensaje al historial
        this.messages.push({
            role: 'user',
            content: message
        });

        // Preparar payload
        const payload = {
            text: message,
            messages: this.messages,
            systemPrompt: this.systemPrompt
        };

        // Enviar mensaje sin esperar callback
        this.socket.emit('openai.test_search', payload);
    }

    clearHistory() {
        this.messages = [];
        console.log('🧹 Historial limpiado');
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
} 