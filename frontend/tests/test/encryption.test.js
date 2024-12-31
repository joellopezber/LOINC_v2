import { encryption } from '../../static/js/utils/encryption.js';
import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

let testRunning = false;
let socket;

/**
 * Inicializa la conexión WebSocket
 */
async function initializeSocket() {
    return new Promise((resolve, reject) => {
        console.log('🔌 Conectando al WebSocket...');
        socket = io({
            transports: ['websocket']
        });

        socket.on('connect', () => {
            console.log('✅ Conectado al WebSocket');
            resolve(socket);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Error de conexión:', error);
            reject(error);
        });

        socket.on('encryption.master_key', (data) => {
            console.log('✅ Master key recibida');
        });
    });
}

/**
 * Test para EncryptionService - Verifica la migración y sincronización de master key
 */
async function testEncryptionService() {
    if (testRunning) {
        console.log('Test ya en ejecución...');
        return;
    }
    testRunning = true;

    try {
        // 0. Asegurar conexión al WebSocket
        if (!socket?.connected) {
            socket = await initializeSocket();
        }

        console.log('\n🧪 Iniciando diagnóstico de EncryptionService...');
        
        // 1. Estado inicial
        console.log('\n1️⃣ Estado inicial:');
        const initialMasterKey = localStorage.getItem('masterKey');
        console.log('Master key en localStorage:', initialMasterKey ? '(presente)' : '(no presente)');
        
        // 2. Inicializar servicio
        console.log('\n2️⃣ Inicializando servicio de encriptación:');
        try {
            await encryption.initialize();
            console.log('✅ Servicio inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando servicio:', error);
            return;
        }
        
        // 3. Verificar migración
        console.log('\n3️⃣ Verificando migración:');
        const finalMasterKey = localStorage.getItem('masterKey');
        console.log('Master key en localStorage después de inicialización:', finalMasterKey ? '(presente)' : '(eliminada)');
        
        // 4. Probar encriptación/desencriptación
        console.log('\n4️⃣ Probando funcionalidad:');
        try {
            // Probar con datos nuevos
            const testData = 'Test de encriptación ' + Date.now();
            console.log('Datos de prueba:', testData);
            
            const encrypted = await encryption.encrypt(testData);
            console.log('Datos encriptados:', encrypted ? '(éxito)' : '(error)');
            
            const decrypted = await encryption.decrypt(encrypted);
            console.log('Datos desencriptados:', decrypted);
            
            if (decrypted === testData) {
                console.log('✅ Encriptación/desencriptación exitosa');
            } else {
                console.error('❌ Error en encriptación/desencriptación');
            }

            // Probar con datos previamente encriptados (si existen)
            const oldApiKey = localStorage.getItem('openaiApiKey');
            if (oldApiKey) {
                console.log('\n5️⃣ Verificando compatibilidad con datos antiguos:');
                const decryptedOld = await encryption.decrypt(oldApiKey);
                console.log('Desencriptación de API key antigua:', decryptedOld ? '(éxito)' : '(error)');
            }
        } catch (error) {
            console.error('❌ Error en prueba de encriptación:', error);
        }
        
        console.log('\n✅ Diagnóstico completado');
    } finally {
        testRunning = false;
    }
}

// Ejecutar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
    const runButton = document.createElement('button');
    runButton.textContent = 'Ejecutar Test Encriptación';
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
        testEncryptionService().catch(error => {
            console.error('❌ Error en prueba:', error);
        });
    });
    
    document.body.appendChild(runButton);
}); 