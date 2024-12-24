export class OpenAITester {
    constructor() {
        console.log('🔄 Inicializando OpenAI Tester...');
        this.chatHistory = [];
        this.createInterface();
        this.bindEvents();
    }

    createInterface() {
        const container = document.createElement('div');
        container.className = 'openai-tester';
        container.innerHTML = `
            <div class="tester-container">
                <div id="configInfo" class="config-info"></div>
                <div class="chat-wrapper">
                    <div id="chatContainer" class="chat-container"></div>
                </div>
                <div class="input-wrapper">
                    <div class="search-container">
                        <input type="text" id="searchText" placeholder="Escribe tu búsqueda aquí..." />
                        <button id="testButton">Enviar</button>
                    </div>
                </div>
            </div>
        `;
 
        document.getElementById('testContainer').appendChild(container);
        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .openai-tester {
                margin-top: 30px;
                width: 100%;
            }

            .tester-container {
                display: flex;
                flex-direction: column;
                height: calc(100vh - 250px);
                min-height: 400px;
                position: relative;
            }

            .chat-wrapper {
                flex: 1;
                overflow: hidden;
                position: relative;
                margin: 20px 0;
            }

            .chat-container {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                flex-direction: column;
                gap: 15px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                overflow-y: auto;
            }

            .input-wrapper {
                position: sticky;
                bottom: 0;
                background: white;
                padding: 15px 0;
                border-top: 1px solid #e5e7eb;
            }

            .search-container {
                display: flex;
                gap: 10px;
                max-width: 100%;
            }

            .search-container input {
                flex: 1;
                padding: 15px;
                font-size: 16px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                transition: border-color 0.3s ease;
            }

            .search-container input:focus {
                outline: none;
                border-color: #3B82F6;
            }

            .search-container button {
                padding: 15px 30px;
                background: #3B82F6;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }

            button:hover {
                opacity: 0.9;
            }

            .config-info {
                padding: 12px;
                background: #f3f4f6;
                border-radius: 6px;
                font-family: monospace;
                font-size: 14px;
            }

            .message {
                max-width: 80%;
                padding: 12px 16px;
                border-radius: 12px;
                position: relative;
                font-size: 15px;
                line-height: 1.5;
            }

            .message.user {
                align-self: flex-end;
                background: #3B82F6;
                color: white;
                border-bottom-right-radius: 4px;
            }

            .message.assistant {
                align-self: flex-start;
                background: white;
                color: #1a1a1a;
                border: 1px solid #e5e7eb;
                border-bottom-left-radius: 4px;
            }

            .message-time {
                font-size: 12px;
                color: #6b7280;
                margin-top: 4px;
                text-align: right;
            }

            .typing {
                align-self: flex-start;
                background: #e5e7eb;
                padding: 12px 16px;
                border-radius: 12px;
                color: #4b5563;
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0% { opacity: 0.5; }
                50% { opacity: 1; }
                100% { opacity: 0.5; }
            }
        `;

        document.head.appendChild(style);
    }

    formatTime() {
        const now = new Date();
        return now.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    addMessage(text, isUser = false) {
        const chatContainer = document.getElementById('chatContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
        
        messageDiv.innerHTML = `
            ${text}
            <div class="message-time">${this.formatTime()}</div>
        `;
        
        // Añadir al historial
        this.chatHistory.push({
            role: isUser ? 'user' : 'assistant',
            content: text,
            timestamp: this.formatTime()
        });
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    showTyping() {
        const chatContainer = document.getElementById('chatContainer');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing';
        typingDiv.id = 'typingIndicator';
        typingDiv.textContent = 'OpenAI está escribiendo...';
        chatContainer.appendChild(typingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    removeTyping() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async bindEvents() {
        const searchInput = document.getElementById('searchText');
        const testButton = document.getElementById('testButton');

        // Manejar búsqueda
        const handleSearch = async () => {
            const searchText = searchInput.value;

            if (!searchText) {
                alert('❌ Se requiere texto de búsqueda');
                return;
            }

            try {
                // Añadir mensaje del usuario
                this.addMessage(searchText, true);
                
                // Mostrar indicador de escritura
                this.showTyping();
                
                // Enviar al backend con el historial
                window.socket.emit('openai.test_search', {
                    text: searchText,
                    history: this.chatHistory
                }, (response) => {
                    // Remover indicador de escritura
                    this.removeTyping();

                    if (response.status === 'success') {
                        // Mostrar configuración
                        const configInfo = document.getElementById('configInfo');
                        configInfo.innerHTML = `
                            <strong>Configuración:</strong><br>
                            🤖 Modelo: ${response.config.model}<br>
                            🌡️ Temperatura: ${response.config.temperature}
                        `;

                        // Añadir respuesta como mensaje
                        this.addMessage(response.response);
                    } else {
                        this.addMessage(`❌ Error: ${response.message}`, false);
                    }
                });

                // Limpiar input
                searchInput.value = '';

            } catch (error) {
                this.removeTyping();
                this.addMessage(`❌ Error: ${error.message}`, false);
            }
        };

        // Eventos
        testButton.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });

        // Focus en el input al inicio
        searchInput.focus();
    }
} 