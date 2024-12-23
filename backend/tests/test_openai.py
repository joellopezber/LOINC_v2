import pytest
import logging
import time
from flask import Flask
from services.openai_service import OpenAIService
from services.websocket_service import WebSocketService
from services.encryption_service import EncryptionService

# Configurar logging para mostrar más detalles
logging.basicConfig(
    level=logging.DEBUG,
    format='%(message)s'  # Solo mostrar el mensaje sin metadata
)
logger = logging.getLogger(__name__)

def test_openai_service():
    """Test de integración del servicio OpenAI"""
    
    # Crear aplicación Flask
    logger.info("\n🔄 Creando aplicación Flask...")
    app = Flask(__name__)
    
    # Crear instancia de WebSocket
    logger.info("\n🔄 Creando instancia de WebSocket...")
    websocket = WebSocketService(app)
    
    # Simular datos que vendrían del frontend
    logger.info("\n🔄 Simulando datos del frontend...")
    install_timestamp = str(int(time.time()))
    
    # API key de prueba
    test_api_key = "sk-test123456789"
    logger.info(f"\n🔑 API Key original: {test_api_key}")
    
    # Encriptar API key
    encryption_service = EncryptionService()
    encrypted_key = encryption_service.encrypt(test_api_key, install_timestamp)
    logger.info(f"\n🔒 API Key encriptada: {encrypted_key}")
    
    # Establecer datos en el WebSocket
    websocket.storage_data = {
        'openai_api_key': encrypted_key,
        'installTimestamp': install_timestamp
    }
    
    # Verificar datos necesarios
    logger.info("\n🔍 Verificando datos del WebSocket...")
    required_keys = ['openai_api_key', 'installTimestamp']
    missing_keys = [key for key in required_keys if key not in websocket.storage_data]
    
    if missing_keys:
        pytest.fail(f"❌ Faltan datos en el WebSocket: {missing_keys}")
        
    # Crear servicio OpenAI
    logger.info("\n🔄 Creando servicio OpenAI...")
    openai = OpenAIService()
    
    # Inicializar servicio
    logger.info("\n🔄 Inicializando servicio OpenAI...")
    success = openai.initialize(websocket)
    
    if not success:
        pytest.fail("❌ Error inicializando servicio OpenAI")
        
    # Probar cambio de modelo
    logger.info("\n🔄 Probando cambio de modelo...")
    openai.set_model("gpt-4")
    assert openai.model == "gpt-4"
    
    # Probar conexión
    logger.info("\n🔄 Probando conexión con OpenAI...")
    result = openai.test_connection()
    
    if result['status'] != 'success':
        pytest.fail(f"❌ Error probando conexión OpenAI: {result['message']}")
    
    # Mostrar respuesta de OpenAI
    logger.info("\n✨ Respuesta de OpenAI:")
    logger.info(f"- Status: {result['status']}")
    logger.info(f"- Message: {result['message']}")
    logger.info(f"- Model: {result['model']}")
    logger.info(f"- Response: {result['response']}")
        
    logger.info("\n✅ Test completado exitosamente") 