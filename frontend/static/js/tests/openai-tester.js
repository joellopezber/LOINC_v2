export class OpenAITester {
    constructor() {
        console.log('🔄 Inicializando OpenAI Tester...');
        this.createInterface();
        this.bindEvents();
    }

    createInterface() {
        const container = document.createElement('div');
        container.className = 'openai-tester';
        container.innerHTML = `
            <div class="tester-container">
                <div class="search-container">
                    <input type="text" id="searchText" placeholder="Escribe tu búsqueda aquí..." />
                    <button id="testButton">Buscar</button>
                </div>

                <div class="results" id="results">
                    <div id="configInfo" class="config-info"></div>
                    <pre id="resultContent"></pre>
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

            .search-container {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
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

            .results {
                margin-top: 20px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                max-height: 400px;
                overflow-y: auto;
            }

            .config-info {
                margin-bottom: 15px;
                padding: 10px;
                background: #e2e8f0;
                border-radius: 4px;
                font-family: monospace;
                font-size: 14px;
            }

            pre {
                margin: 0;
                white-space: pre-wrap;
                font-size: 14px;
                line-height: 1.5;
            }
        `;

        document.head.appendChild(style);
    }

    formatResponse(response) {
        if (!response) return '';
        
        // Mostrar configuración
        const configInfo = document.getElementById('configInfo');
        if (response.config) {
            configInfo.innerHTML = `
                <strong>Configuración:</strong><br>
                🤖 Modelo: ${response.config.model}<br>
                🌡️ Temperatura: ${response.config.temperature}
            `;
        }

        // Formatear respuesta principal
        const formattedResponse = {
            status: response.status,
            query: response.query,
            response: response.response,
            config: response.config  // Incluir la configuración en la respuesta
        };

        return JSON.stringify(formattedResponse, null, 2);
    }

    async bindEvents() {
        const searchInput = document.getElementById('searchText');
        const testButton = document.getElementById('testButton');
        const resultContent = document.getElementById('resultContent');

        // Manejar búsqueda
        const handleSearch = async () => {
            const searchText = searchInput.value;

            if (!searchText) {
                resultContent.textContent = '❌ Se requiere texto de búsqueda';
                return;
            }

            try {
                resultContent.textContent = '🔄 Procesando búsqueda...';
                document.getElementById('configInfo').innerHTML = '';
                
                // Enviar solo el texto al backend
                window.socket.emit('openai.test_search', {
                    text: searchText
                }, (response) => {
                    resultContent.textContent = this.formatResponse(response);
                });

            } catch (error) {
                resultContent.textContent = `❌ Error: ${error.message}`;
            }
        };

        // Eventos
        testButton.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }
} 