/**
 * Test para StorageService - Muestra información del estado
 */
async function testStorageService() {
    console.log('\n🧪 Iniciando diagnóstico de StorageService...');
    
    // 1. Estado inicial
    console.log('\n1️⃣ Estado del localStorage:');
    const initialLocalStorage = localStorage.getItem('searchConfig');
    console.log('localStorage:', initialLocalStorage ? JSON.parse(initialLocalStorage) : 'vacío');
    
    // 2. Obtener configuración del servicio
    console.log('\n2️⃣ Configuración desde StorageService:');
    const config = await window.storageService.getSearchConfig();
    console.log('Configuración actual:', config);
    
    // 3. Estado de la conexión
    console.log('\n3️⃣ Estado de la conexión:');
    console.log('WebSocket conectado:', window.socket?.connected);
    console.log('Socket ID:', window.socket?.id);
    
    // 4. Sincronizar con servidor
    console.log('\n4️⃣ Sincronización con servidor:');
    try {
        await window.storageService._syncWithServer();
        console.log('Sincronización completada');
    } catch (error) {
        console.log('Error en sincronización:', error);
    }
    
    // 5. Estado final
    console.log('\n5️⃣ Estado final:');
    const finalConfig = await window.storageService.getSearchConfig();
    console.log('Configuración final:', finalConfig);
    
    console.log('\n✅ Diagnóstico completado');
}

// Ejecutar diagnóstico cuando el documento esté listo y conectado
document.addEventListener('DOMContentLoaded', () => {
    // Esperar conexión WebSocket
    const checkConnection = setInterval(() => {
        if (window.socket?.connected) {
            clearInterval(checkConnection);
            testStorageService().catch(error => {
                console.error('❌ Error en diagnóstico:', error);
            });
        }
    }, 100);
    
    // Timeout después de 5 segundos
    setTimeout(() => {
        clearInterval(checkConnection);
        if (!window.socket?.connected) {
            console.error('❌ WebSocket no conectado después de 5 segundos');
        }
    }, 5000);
}); 