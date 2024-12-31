import { apiKeyService } from '../../static/js/services/api-key.service.js';
import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

let testRunning = false;
let socket;

/**
 * Inicializa la conexión WebSocket
 */
async function initializeSocket() {
    return new Promise((resolve, reject) => {
        console.log('🔌 Conectando al backend (puerto 5001)...');
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

        // Escuchar master key
        socket.on('encryption.master_key', (data) => {
            console.log('✅ Master key recibida del backend');
        });

        // Escuchar todos los eventos para debug
        socket.onAny((eventName, ...args) => {
            console.log(`📨 Evento recibido [${eventName}]:`, args);
        });
    });
}

/**
 * Test para OpenAI Service
 */
async function testOpenAIService() {
    if (testRunning) {
        console.log('Test ya en ejecución...');
        return;
    }
    testRunning = true;

    try {
        // 0. Asegurar conexión al backend
        if (!socket?.connected) {
            socket = await initializeSocket();
        }

        console.log('\n🧪 Iniciando prueba de OpenAI Service...');
        
        // 1. Obtener API key encriptada directamente de localStorage
        console.log('\n1️⃣ Recuperando API key encriptada de OpenAI:');
        const encryptedKey = localStorage.getItem('openaiApiKey');
        if (!encryptedKey) {
            console.log('❌ No se encontró API key encriptada de OpenAI en localStorage');
            console.log('💡 Por favor, configura una API key en el modal de configuración');
            return;
        }
        console.log('✅ API key encriptada recuperada');
        console.log('📝 Longitud de la API key encriptada:', encryptedKey.length);
        console.log('📝 Primeros 50 caracteres:', encryptedKey.substring(0, 50));

        // 2. Enviar prompt a OpenAI
        console.log('\n2️⃣ Enviando prompt a OpenAI:');
        const prompt = 'Explica qué es un hemograma y sus valores normales';
        console.log('Prompt:', prompt);
        
        const requestData = {
            api_key: encryptedKey,
            prompt: prompt
        };
        console.log('📤 Enviando datos:', {
            ...requestData,
            api_key: `${requestData.api_key.substring(0, 20)}...`
        });
        
        socket.emit('openai.process_prompt', requestData);

        // 3. Esperar respuesta
        console.log('\n3️⃣ Esperando respuesta...');
        const response = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Timeout esperando respuesta de OpenAI'));
            }, 30000);

            socket.once('openai.prompt_response', (data) => {
                clearTimeout(timeoutId);
                resolve(data);
            });
        });

        // 4. Mostrar resultado
        console.log('\n4️⃣ Respuesta recibida:');
        if (response.success) {
            console.log('✅ Respuesta exitosa:');
            console.log(response.data.response);
            console.log(`Tokens utilizados: ${response.data.usage}`);
        } else {
            console.error('❌ Error:', response.error);
            console.error('Detalles de la respuesta:', response);
        }
        
        console.log('\n✅ Prueba completada');
    } catch (error) {
        console.error('\n❌ Error en la prueba:', error);
        console.error('Stack trace:', error.stack);
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
            console.error('❌ Error en prueba:', error);
            console.error('Stack trace:', error.stack);
        });
    });
    
    document.body.appendChild(runButton);
}); 