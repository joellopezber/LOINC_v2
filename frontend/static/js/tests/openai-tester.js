export class OpenAITester {
    constructor() {
        console.log('🔄 Iniciando OpenAI Tester...');
        this.messages = [];
        this.systemPrompt = "Eres un asistente médico experto en LOINC. Ayudas a los usuarios a entender términos médicos y pruebas de laboratorio.";
        this.initialize();
    }

    async initialize() {
        try {
            // Inicializar storage
            await window.storage.initialize();
            console.log('✅ Storage inicializado');
        } catch (error) {
            console.error('❌ Error inicializando OpenAI Tester:', error);
        }
    }

    async sendMessage(userMessage) {
        try {
            console.log('🚀 Enviando mensaje a OpenAI...');
            
            // Añadir mensaje del usuario al historial
            this.messages.push({
                role: 'user',
                content: userMessage
            });

            // Preparar el payload con todo el historial
            const payload = {
                text: userMessage,
                messages: this.messages,
                systemPrompt: this.systemPrompt
            };
            
            // Enviar al backend
            return new Promise((resolve) => {
                window.socket.emit('openai.test_search', payload, (response) => {
                    console.log('📝 Respuesta recibida:', response);
                    
                    if (response.status === 'success') {
                        // Añadir respuesta al historial
                        this.messages.push({
                            role: 'assistant',
                            content: response.response
                        });
                    }
                    
                    resolve(response);
                });
            });
        } catch (error) {
            console.error('❌ Error enviando mensaje:', error);
            return {
                status: 'error',
                message: error.message || 'Error enviando mensaje'
            };
        }
    }

    clearHistory() {
        this.messages = [];
        console.log('🧹 Historial limpiado');
    }
} 