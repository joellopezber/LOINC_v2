import { encryption } from '../utils/encryption.js';

let testRunning = false;

/**
 * Test para EncryptionService - Verifica la sincronización de master key
 */
async function testEncryptionService() {
    if (testRunning) {
        console.log('Test ya en ejecución...');
        return;
    }
    testRunning = true;

    try {
        console.log('\n🧪 Iniciando diagnóstico de EncryptionService...');
        
        // 1. Estado inicial
        console.log('\n1️⃣ Estado del localStorage:');
        const initialMasterKey = localStorage.getItem('masterKey');
        console.log('Master key inicial:', initialMasterKey ? '(presente)' : '(no presente)');
        
        // 2. Inicializar servicio
        console.log('\n2️⃣ Inicializando servicio de encriptación:');
        try {
            await encryption.initialize();
            console.log('✅ Servicio inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando servicio:', error);
            return;
        }
        
        // 3. Verificar sincronización
        console.log('\n3️⃣ Verificando sincronización con backend:');
        const finalMasterKey = localStorage.getItem('masterKey');
        console.log('Master key final:', finalMasterKey ? '(presente)' : '(no presente)');
        
        // 4. Probar encriptación/desencriptación
        console.log('\n4️⃣ Probando encriptación:');
        try {
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
        } catch (error) {
            console.error('❌ Error en prueba de encriptación:', error);
        }
        
        console.log('\n✅ Diagnóstico completado');
    } finally {
        testRunning = false;
    }
}

// Ejecutar cuando el documento esté listo y el WebSocket conectado
if (window.socket?.connected) {
    testEncryptionService().catch(error => {
        console.error('❌ Error en diagnóstico:', error);
    });
} else {
    window.socket.on('connect', () => {
        testEncryptionService().catch(error => {
            console.error('❌ Error en diagnóstico:', error);
        });
    });
} 