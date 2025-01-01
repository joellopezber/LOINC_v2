import { apiKeyService } from '../../static/js/services/api-key.service.js';
import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

let testRunning = false;
let socket;

/**
 * Inicializa la conexión WebSocket
 */
async function initializeSocket() {
    return new Promise((resolve, reject) => {
        socket = io('http://localhost:5001', {
            transports: ['websocket']
        });

        socket.on('connect', () => {
            console.log('✅ Conectado al backend');
            resolve(socket);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Error de conexión:', error);
            reject(error);
        });
    });
}

/**
 * Test para OpenAI Service
 */
async function testOpenAIService() {
    if (testRunning) {
        console.log('Test ya en ejecución');
        return;
    }
    testRunning = true;

    try {
        // 0. Asegurar conexión al backend
        if (!socket?.connected) {
            socket = await initializeSocket();
        }

        console.log('🧪 Iniciando test OpenAI');
        
        // 1. Obtener API key
        const encryptedKey = localStorage.getItem('openaiApiKey');
        if (!encryptedKey) {
            console.log('❌ API key no encontrada');
            return;
        }
        console.log('✅ API key recuperada');

        // 2. Enviar prompt
        const prompt = 'Explica qué es un hemograma y sus valores normales';
        const requestData = {
            api_key: encryptedKey,
            prompt: prompt
        };
        
        socket.emit('openai.process_prompt', requestData);

        // 3. Esperar respuesta
        const response = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Timeout esperando respuesta'));
            }, 30000);

            socket.once('openai.prompt_response', (data) => {
                clearTimeout(timeoutId);
                resolve(data);
            });
        });

        // 4. Mostrar resultado
        if (response.success) {
            console.log('✅ Respuesta recibida');
        } else {
            console.error('❌ Error:', response.error);
        }
        
    } catch (error) {
        console.error('❌ Error en test:', error);
    } finally {
        testRunning = false;
    }
}

// Ejecutar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
    const runButton = document.createElement('button');
    runButton.textContent = 'Ejecutar Test OpenAI';
    runButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    
    runButton.addEventListener('click', () => {
        testOpenAIService().catch(error => {
            console.error('❌ Error en test:', error);
        });
    });
    
    document.body.appendChild(runButton);
}); 