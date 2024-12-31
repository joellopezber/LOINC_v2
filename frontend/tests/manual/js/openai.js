export class OpenAITester {
    constructor() {
        this.socket = null;
        this.messages = [];
        this.isConnected = false;
        this.onConnectionChange = null;
        this.onMessageReceived = null;
        this.onTypingStart = null;
        this.onTypingEnd = null;

        // Configuración por defecto
        this.config = {
            model: 'gpt-4o',
            temperature: 0.7,
            systemPrompt: 'Eres un asistente personalizado de chat que ayuda a los usuarios de manera amable y profesional.'
        };
    }

    // Métodos para configurar parámetros
    setModel(model) {
        this.config.model = model;
        console.log('🤖 Modelo configurado:', model);
    }

    setTemperature(temperature) {
        this.config.temperature = temperature;
        console.log('🌡️ Temperatura configurada:', temperature);
    }

    setSystemPrompt(prompt) {
        this.config.systemPrompt = prompt;
        console.log('📝 System prompt configurado:', prompt);
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
                this.onMessageReceived?.(response.message || 'Error desconocido', true);
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

        // Obtener install_id
        const install_id = localStorage.getItem('installTimestamp');
        if (!install_id) {
            throw new Error('No se encontró install_id');
        }

        // Preparar payload con todos los parámetros
        const payload = {
            text: message,
            messages: this.messages,
            install_id: install_id,
            model: this.config.model,
            temperature: this.config.temperature,
            systemPrompt: this.config.systemPrompt
        };

        console.log('📤 Enviando payload:', {
            ...payload,
            messages: `${payload.messages.length} mensajes`
        });

        // Enviar mensaje
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