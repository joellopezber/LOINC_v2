import pytest
import logging
import json
from services.on_demand.database_search_service import DatabaseSearchService
from services.core.websocket_service import WebSocketService

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

def test_search_service(data, websocket_instance=None):
    """Test del servicio de búsqueda"""
    try:
        # Imprimir estado inicial
        logger.info("\n=== ESTADO INICIAL ===")
        logger.info(f"Data: {data}")
        if websocket_instance:
            logger.info(f"WebSocket Instance: {websocket_instance}")
            logger.info(f"WebSocket Dir: {dir(websocket_instance)}")
            if hasattr(websocket_instance, 'storage_data'):
                logger.info(f"Storage Data: {websocket_instance.storage_data}")
        else:
            logger.info("No hay instancia de WebSocket")
        logger.info("=====================")

        # Crear instancia de SearchService
        search_service = SearchService(websocket_instance)
        
        # Imprimir estado después de inicialización
        logger.info("\n=== ESTADO DESPUÉS DE INICIALIZACIÓN ===")
        logger.info(f"SearchService: {search_service}")
        logger.info(f"SearchService WebSocket: {search_service.websocket}")
        if hasattr(search_service.websocket, 'storage_data'):
            logger.info(f"SearchService Storage: {search_service.websocket.storage_data}")
        logger.info("========================================")

        return {
            'status': 'success',
            'message': 'Test completado correctamente'
        }
    except Exception as e:
        logger.error(f"❌ Error en test: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

def handle_test_search(data, websocket_instance=None):
    """Maneja la solicitud de test desde el frontend"""
    logger.info("\n🔄 Recibida solicitud de test de búsqueda desde frontend")
    
    # Imprimir todos los datos disponibles
    logger.info("\n=== DATOS DEL WEBSOCKET ===")
    if websocket_instance:
        logger.info(f"WebSocket Instance: {websocket_instance}")
        logger.info(f"WebSocket Dir: {dir(websocket_instance)}")
        if hasattr(websocket_instance, 'storage_data'):
            logger.info(f"Storage Data: {websocket_instance.storage_data}")
    else:
        logger.info("No hay instancia de WebSocket")
    logger.info(f"Datos recibidos: {data}")
    logger.info("========================")
    
    return test_search_service(data, websocket_instance)

def test_search_service_websocket_data(mocker):
    """
    Test para verificar que el SearchService recibe y procesa correctamente 
    los datos del WebSocket.
    """
    # Mock del WebSocket con datos reales
    mock_websocket = mocker.Mock()
    mock_websocket.storage_data = {
        'searchConfig': {
            'search': {
                'ontologyMode': 'multi_match',
                'dbMode': 'elastic',
                'openai': {
                    'useOriginalTerm': True,
                    'useEnglishTerm': True,
                    'useRelatedTerms': False,
                    'useTestTypes': False,
                    'useLoincCodes': False,
                    'useKeywords': True
                }
            },
            'sql': {
                'maxTotal': 150,
                'maxPerKeyword': 100,
                'maxKeywords': 10,
                'strictMode': True
            },
            'elastic': {
                'limits': {
                    'maxTotal': 50,
                    'maxPerKeyword': 10
                },
                'searchTypes': {
                    'exact': {
                        'enabled': False,
                        'priority': 10
                    },
                    'fuzzy': {
                        'enabled': False,
                        'tolerance': 2
                    },
                    'smart': {
                        'enabled': False,
                        'precision': 7
                    }
                },
                'showAdvanced': False
            },
            'performance': {
                'maxCacheSize': 100,
                'cacheExpiry': 24
            }
        },
        'openaiApiKey': 'ns3/ijEIzdGksu14L6XNWyvN2a0HYog7RTSgEf6aPZWeA8HHr6xoSGa8a/DlXl3pUwPfHNg82AbpRKCLaB3YDEdpz3ZnsbaWOJGefI3Ly/m4RfalmRn1wg4WFmdEtj8j5p5Hv63lAo53DCi2Sc2Qs0gFlvfemoAQfByT39H+l2auxQ8GQ/K4eEQQ6BYq6eMC1+HuFBpEtrZ9hHekVVe/dG7rZtnJpwILljBiDnx+K8GPD+Kmg5m0hVHTdap1mE/Hj3sCvvYmZsEr7XbWRfnO0Q==',
        'installTimestamp': '1734996906305'
    }

    # Log de datos iniciales
    logger.info("\n=== DATOS INICIALES DEL WEBSOCKET ===")
    logger.info(json.dumps(mock_websocket.storage_data, indent=2))
    logger.info("=====================================")

    # Crear instancia de SearchService con el mock
    search_service = SearchService(mock_websocket)
    
    # Verificar inicialización
    assert search_service.websocket is not None, "WebSocket no inicializado"
    assert search_service.websocket.storage_data is not None, "Storage data no disponible"
    
    # Verificar que puede obtener la configuración
    user_id = "test_user"
    success = search_service.initialize_user_config(user_id)
    
    # Log del resultado
    logger.info("\n=== RESULTADO DE INICIALIZACIÓN ===")
    logger.info(f"Success: {success}")
    if user_id in search_service._user_configs:
        logger.info(f"User Config: {json.dumps(search_service._user_configs[user_id], indent=2)}")
    logger.info("=================================")
    
    assert success, "No se pudo inicializar la configuración del usuario"
    
    # Verificar que la configuración se guardó correctamente
    user_config = search_service._user_configs.get(user_id)
    assert user_config is not None, "Configuración de usuario no guardada"
    assert user_config['preferred_service'] == 'elastic', "Servicio preferido incorrecto"
    
    # Verificar que el servicio preferido se obtiene correctamente
    service = search_service.get_user_preference(user_id)
    assert service == 'elastic', "Servicio preferido no coincide"

def test_search_service_invalid_websocket_data(mocker):
    """
    Test para verificar el manejo de datos inválidos del WebSocket.
    """
    # Mock del WebSocket con datos inválidos
    mock_websocket = mocker.Mock()
    mock_websocket.storage_data = {
        'searchConfig': {
            'value': {
                'search': {
                    'dbMode': 'invalid_mode'  # Modo inválido
                }
            }
        }
    }

    # Crear instancia de SearchService con el mock
    search_service = SearchService(mock_websocket)
    
    # Verificar que maneja correctamente datos inválidos
    user_id = "test_user"
    success = search_service.initialize_user_config(user_id)
    assert not success, "Debería fallar con modo inválido"
    
    # Verificar que usa el servicio por defecto
    service = search_service.get_user_preference(user_id)
    assert service == 'sql', "No está usando el servicio por defecto"
    
    # Log del resultado para debug
    logger.debug(f"✅ Servicio por defecto usado correctamente: {service}")

def test_search_service_missing_websocket_data(mocker):
    """
    Test para verificar el manejo de datos faltantes del WebSocket.
    """
    # Mock del WebSocket sin datos
    mock_websocket = mocker.Mock()
    mock_websocket.storage_data = {}

    # Crear instancia de SearchService con el mock
    search_service = SearchService(mock_websocket)
    
    # Verificar que maneja correctamente datos faltantes
    user_id = "test_user"
    success = search_service.initialize_user_config(user_id)
    assert not success, "Debería fallar con datos faltantes"
    
    # Verificar que usa el servicio por defecto
    service = search_service.get_user_preference(user_id)
    assert service == 'sql', "No está usando el servicio por defecto"
    
    # Log del resultado para debug
    logger.debug(f"✅ Manejo correcto de datos faltantes, usando servicio: {service}") 