from flask import Blueprint, request, jsonify
from services.on_demand.database_search_service import DatabaseSearchService
import logging
from flask_socketio import emit
from datetime import datetime
from services.service_locator import service_locator

# Configurar logging
logger = logging.getLogger(__name__)

# Crear Blueprint para rutas API
api_routes = Blueprint('api_routes', __name__)

def get_search_service():
    """
    Obtiene o crea el servicio de búsqueda de forma lazy
    
    Returns:
        DatabaseSearchService: Instancia del servicio
    """
    search_service = service_locator.get('database_search')
    if not search_service:
        logger.info("🔄 Creando nueva instancia de DatabaseSearchService")
        search_service = DatabaseSearchService()
        service_locator.register('database_search', search_service)
    return search_service

def init_socket_routes(socketio, search_service=None):
    """
    Inicializa las rutas de WebSocket.
    
    Args:
        socketio: Instancia de SocketIO
        search_service: Instancia opcional de DatabaseSearchService
    """
    logger.info("🚀 Inicializando rutas de WebSocket")

    @socketio.on('connect')
    def handle_connect():
        """Maneja nueva conexión WebSocket"""
        logger.info(f"📡 Nueva conexión: {request.sid}")
        emit('connect_response', {'status': 'connected', 'sid': request.sid})

    @socketio.on('disconnect')
    def handle_disconnect():
        """Maneja desconexión WebSocket"""
        logger.info(f"👋 Desconexión: {request.sid}")

    @socketio.on('openai.test_search')
    def handle_openai_test(data):
        """Maneja solicitudes de test de OpenAI"""
        try:
            from tests.test_openai import handle_test_search
            logger.info(f"🤖 Test OpenAI recibido: {data}")
            result = handle_test_search(data, socketio)
            emit('openai.test_result', result)
        except Exception as e:
            logger.error(f"❌ Error en test OpenAI: {str(e)}")
            emit('openai.test_result', {
                'status': 'error',
                'message': str(e)
            })

    @socketio.on('ontology.search')
    def handle_ontology_search(data):
        """Maneja solicitudes de búsqueda ontológica"""
        try:
            from tests.test_ontology import handle_ontology_search
            logger.info(f"🔍 Búsqueda ontológica recibida: {data}")
            result = handle_ontology_search(data, socketio)
            emit('ontology.search_result', result)
        except Exception as e:
            logger.error(f"❌ Error en búsqueda ontológica: {str(e)}")
            emit('ontology.search_result', {
                'status': 'error',
                'message': str(e)
            })

    @socketio.on('search')
    def handle_search(data):
        """
        Maneja solicitudes de búsqueda.
        
        Args:
            data: Diccionario con parámetros de búsqueda
        """
        try:
            logger.info(f"🔍 Búsqueda recibida: {data}")
            
            if not data or 'query' not in data:
                raise ValueError("Query no proporcionada")

            query = data['query']
            user_id = data.get('user_id', request.sid)
            
            # Obtener servicio de forma lazy
            search_service = get_search_service()
            
            results = search_service.search_loinc(query, user_id)
            
            response = {
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'service': search_service.get_user_preference(user_id),
                'results': results
            }
            
            emit('search_result', response)
            return response

        except Exception as e:
            logger.error(f"❌ Error en búsqueda: {str(e)}", exc_info=True)
            error_response = {
                'status': 'error',
                'timestamp': datetime.now().isoformat(),
                'message': str(e)
            }
            emit('error', error_response)
            return error_response

    logger.info("✅ Rutas de WebSocket inicializadas")

# Rutas REST API
@api_routes.route('/api/health')
def health_check():
    """Endpoint para verificar el estado del servidor"""
    try:
        user_id = request.headers.get('X-User-Id') or request.args.get('user_id')
        if not user_id:
            return jsonify({'error': 'X-User-Id header is required'}), 400
            
        return jsonify({
            'status': 'ok',
            'message': 'Server is running'
        })
    except Exception as e:
        logger.error(f"Error en health check: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@api_routes.route('/api/loinc/search', methods=['GET'])
def search_loinc():
    """Endpoint para buscar en la documentación LOINC"""
    try:
        user_id = request.headers.get('X-User-Id')
        if not user_id:
            return jsonify({'error': 'X-User-Id header is required'}), 400
            
        query = request.args.get('q', '')
        if not query:
            return jsonify({'error': 'Query parameter "q" is required'}), 400
            
        limit = int(request.args.get('limit', 10))
        results = search_service.search_loinc(query, user_id, limit)
        
        return jsonify(results)
    except Exception as e:
        logger.error(f"Error en búsqueda LOINC: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/api/loinc/bulk', methods=['POST'])
def bulk_insert_loinc():
    """Endpoint para inserción masiva de documentos LOINC"""
    try:
        user_id = request.headers.get('X-User-Id')
        if not user_id:
            return jsonify({'error': 'X-User-Id header is required'}), 400
            
        docs = request.json
        if not docs or not isinstance(docs, list):
            return jsonify({'error': 'Invalid data format'}), 400
            
        status = search_service.bulk_insert_docs(docs, user_id)
        
        if status['success']:
            return jsonify({
                'message': 'Documents processed successfully',
                'status': status
            })
        else:
            return jsonify({
                'error': 'Failed to insert documents',
                'status': status
            }), 500
    except Exception as e:
        logger.error(f"Error en inserción LOINC: {e}")
        return jsonify({'error': str(e)}), 500