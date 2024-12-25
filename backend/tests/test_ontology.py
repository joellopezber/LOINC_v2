import pytest
import logging
import json
import re
from services.ontology_service import ontology_service
from services.openai_service import OpenAIService
from services.websocket_service import WebSocketService

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

def clean_json_response(response: str) -> str:
    """
    Limpia la respuesta de OpenAI para obtener un JSON válido
    1. Elimina los bloques de código markdown
    2. Elimina los comentarios del JSON
    3. Encuentra el JSON válido
    """
    # 1. Eliminar bloques de código markdown
    response = re.sub(r'```json\n|\n```', '', response)
    
    # 2. Eliminar comentarios del JSON (// comments)
    response = re.sub(r'//.*$', '', response, flags=re.MULTILINE)
    
    # 3. Encontrar el primer JSON válido
    json_match = re.search(r'(\{.*\})', response, re.DOTALL)
    if not json_match:
        raise ValueError("No se encontró un JSON válido en la respuesta")
        
    json_str = json_match.group(1)
    
    # 4. Limpiar espacios extra y líneas vacías
    json_str = re.sub(r',(\s*[\]}])', r'\1', json_str)
    
    return json_str

def test_ontology_service(data, websocket_instance=None):
    """Test de integración del servicio de ontología"""
    
    logger.info("\n🔄 Iniciando test de Ontología...")
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
        term = data.get('text', '')

        if not all([encrypted_key, install_timestamp, term]):
            logger.error("❌ Faltan datos requeridos")
            return {
                'status': 'error',
                'message': 'Se requiere API Key, Installation Time y término a buscar',
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
            
        # 3. Procesar término
        logger.info(f"\n3️⃣ Procesando término: {term}")
        
        response = ontology_service.process_term(
            term=term,
            openai_service=openai
        )
        
        if not response:
            logger.error("❌ Error al procesar el término")
            return {
                'status': 'error',
                'message': 'Error al procesar el término',
                'details': result
            }

        # 4. Procesar respuesta JSON
        try:
            # Log de la respuesta completa
            logger.info("\n4️⃣ Respuesta de OpenAI:")
            logger.info("-" * 80)
            logger.info(response)
            logger.info("-" * 80)

            # Limpiar y extraer JSON
            json_str = clean_json_response(response)
            logger.info("\n5️⃣ JSON limpio:")
            logger.info("-" * 80)
            logger.info(json_str)
            logger.info("-" * 80)

            # Parsear JSON
            result = json.loads(json_str)
            
            # Validar estructura mínima
            required_fields = ['term_in_english', 'related_terms', 'test_types', 'loinc_codes', 'keywords']
            missing_fields = [field for field in required_fields if field not in result]
            
            if missing_fields:
                logger.error(f"❌ Faltan campos requeridos: {missing_fields}")
                return {
                    'status': 'error',
                    'message': f'Faltan campos en la respuesta: {", ".join(missing_fields)}',
                    'details': result
                }

            # 6. Éxito
            return {
                'status': 'success',
                'query': term,
                'response': result
            }

        except json.JSONDecodeError as e:
            logger.error(f"❌ Error parseando JSON: {e}")
            logger.error("Respuesta problemática:")
            logger.error("-" * 80)
            logger.error(response)
            logger.error("-" * 80)
            return {
                'status': 'error',
                'message': 'Error al procesar la respuesta',
                'details': result
            }
        except ValueError as e:
            logger.error(f"❌ Error procesando respuesta: {str(e)}")
            return {
                'status': 'error',
                'message': str(e),
                'details': result
            }
        
    except Exception as e:
        logger.error(f"\n❌ Error en test: {str(e)}")
        return {
            'status': 'error',
            'message': str(e),
            'details': result
        }

def handle_ontology_search(data, websocket_instance=None):
    """Maneja la solicitud de búsqueda ontológica desde el frontend"""
    logger.info("\n🔄 Recibida solicitud de búsqueda ontológica desde frontend")
    return test_ontology_service(data, websocket_instance) 