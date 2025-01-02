import { BaseTester } from './base.js';

export class OpenAITester extends BaseTester {
    constructor() {
        super();
        console.log('🔄 Inicializando OpenAITester');
        this.messages = [];
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

    async initialize() {
        // Escuchar respuestas de OpenAI
        this._ws.socket.on('openai.test_result', (response) => {
            if (response.status === 'success') {
                // Añadir respuesta al historial
                this.messages.push({
                    role: 'assistant',
                    content: response.response
                });
                this.onMessageReceived?.(response.response, false);
            } else {
                console.error('❌ Error en respuesta:', response.message || 'Error desconocido');
                this.onMessageReceived?.(response.message || 'Error desconocido', true);
            }
            this.onTypingEnd?.();
        });
    }

    async sendMessage(message) {
        if (!this.isConnected) {
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

        // Generar request_id único
        const request_id = Math.random().toString(36).substring(7);

        // Preparar payload con todos los parámetros
        const payload = {
            text: message,
            messages: this.messages,
            install_id: install_id,
            model: this.config.model,
            temperature: this.config.temperature,
            systemPrompt: this.config.systemPrompt,
            request_id: request_id
        };

        // Enviar mensaje usando socket.emit
        this._ws.socket.emit('openai.test_search', payload);
    }

    clearHistory() {
        this.messages = [];
        console.log('🧹 Historial limpiado');
    }
} 