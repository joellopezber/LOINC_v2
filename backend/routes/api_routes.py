from flask import Blueprint, request, jsonify
from services.search_service import SearchService
import logging
from flask_socketio import emit
from datetime import datetime

# Configurar logging
logger = logging.getLogger(__name__)

# Crear Blueprint para rutas API
api_routes = Blueprint('api_routes', __name__)

def init_socket_routes(socketio, search_service):
    """
    Inicializa las rutas de WebSocket.
    
    Args:
        socketio: Instancia de SocketIO
        search_service: Instancia de SearchService
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