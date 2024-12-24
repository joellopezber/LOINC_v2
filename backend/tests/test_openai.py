import pytest
import logging
import time
import os
from flask import Flask
from services.openai_service import (
    OpenAIService, 
    DEFAULT_MODEL, 
    DEFAULT_TEMPERATURE,
    DEFAULT_SYSTEM_PROMPT
)
from services.websocket_service import WebSocketService
import json

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

# Configuración específica para el test (sobreescribe los valores por defecto de OpenAI)
TEST_CONFIG = {
    'model': 'gpt-4o',  # Podemos usar un modelo diferente al default
    'temperature': 0.5,  # Podemos usar una temperatura diferente
    'system_prompt': """
    Eres un asistente experto en LOINC especializado en testing.
    Tu objetivo es validar la funcionalidad del sistema respondiendo consultas de prueba.
    
    Reglas:
    1. Sé breve y directo
    2. Usa ejemplos concretos
    3. Valida la información proporcionada
    4. Mantén un tono técnico pero claro
    5. Si hay errores, indícalos específicamente
    """
}

def test_openai_service(data, websocket_instance=None):
    """Test de integración del servicio OpenAI con mensaje real"""
    
    logger.info("\n🔄 Iniciando test de OpenAI...")
    result = {
        'status': 'pending',
        'steps': []
    }
    
    try:
        if not websocket_instance:
            logger.error("❌ No se proporcionó instancia de WebSocket")
            return {
                'status': 'error',
                'message': 'Se requiere instancia de WebSocket',
                'details': result
            }

        # 1. Verificar datos en WebSocket
        logger.info("\n1️⃣ Verificando datos en WebSocket...")
        logger.info(f"📦 Storage Data: {json.dumps(websocket_instance.storage_data, indent=2)}")
        
        encrypted_key = websocket_instance.storage_data.get('openaiApiKey')
        install_timestamp = websocket_instance.storage_data.get('installTimestamp')
        text_query = data.get('text', '¿Qué es LOINC?')

        # Obtener configuración del test
        # Prioridad: 1. Datos del request, 2. TEST_CONFIG, 3. DEFAULT de OpenAI
        test_config = {
            'model': data.get('model', TEST_CONFIG.get('model', DEFAULT_MODEL)),
            'temperature': data.get('temperature', TEST_CONFIG.get('temperature', DEFAULT_TEMPERATURE)),
            'system_prompt': data.get('system_prompt', TEST_CONFIG.get('system_prompt', DEFAULT_SYSTEM_PROMPT))
        }

        if not all([encrypted_key, install_timestamp]):
            logger.error("❌ Faltan datos requeridos en WebSocket")
            return {
                'status': 'error',
                'message': 'Se requiere API Key e Installation Time',
                'details': result
            }
            
        # 2. Inicializar OpenAI con key encriptada
        logger.info("\n2️⃣ Inicializando servicio OpenAI...")
        openai = OpenAIService()
        success = openai.initialize_with_encrypted(encrypted_key, install_timestamp)
        
        if not success:
            logger.error("❌ Error inicializando OpenAI")
            return {
                'status': 'error',
                'message': 'Error al inicializar OpenAI',
                'details': result
            }
            
        # 3. Procesar consulta
        logger.info(f"\n3️⃣ Procesando consulta: {text_query}")
        logger.info(f"📝 Configuración:")
        logger.info(f"   - Modelo: {test_config['model']}")
        logger.info(f"   - Temperatura: {test_config['temperature']}")
        
        response = openai.process_query(
            user_prompt=text_query,
            model=test_config['model'],
            temperature=test_config['temperature'],
            system_prompt=test_config['system_prompt']
        )
        
        if not response:
            logger.error("❌ Error al procesar la consulta")
            return {
                'status': 'error',
                'message': 'Error al procesar la consulta',
                'details': result
            }
            
        # 4. Éxito
        return {
            'status': 'success',
            'query': text_query,
            'response': response,
            'config': test_config
        }
        
    except Exception as e:
        logger.error(f"\n❌ Error en test: {str(e)}")
        return {
            'status': 'error',
            'message': str(e),
            'details': result
        }

def handle_test_search(data, websocket_instance=None):
    """Maneja la solicitud de test desde el frontend"""
    logger.info("\n🔄 Recibida solicitud de test desde frontend")
    return test_openai_service(data, websocket_instance) 