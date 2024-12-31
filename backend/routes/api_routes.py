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
    """Inicializa las rutas de WebSocket"""
    logger.info("🚀 Inicializando rutas de WebSocket")

    # Registrar handlers básicos
    @socketio.on('connect')
    def handle_connect():
        logger.info(f"📡 Nueva conexión: {request.sid}")
        emit('connect_response', {'status': 'connected', 'sid': request.sid})

    @socketio.on('disconnect')
    def handle_disconnect():
        logger.info(f"👋 Desconexión: {request.sid}")

    # Registrar handlers de servicios
    try:
        from services.handlers.on_demand.openai_handlers import OpenAIHandlers
        logger.info("🤖 Registrando handler de OpenAI")
        OpenAIHandlers(socketio)  # Se auto-registra en el constructor
        logger.info("✅ Handler de OpenAI registrado")
    except Exception as e:
        logger.error(f"❌ Error registrando handler de OpenAI: {str(e)}")

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