from flask import Blueprint, request, jsonify
from services.search_service import SearchService
import logging
from flask_socketio import emit
from datetime import datetime

# Crear Blueprint para rutas API
api_routes = Blueprint('api_routes', __name__)

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

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
        logger.info(f"📡 Nueva conexión: {request.sid}")
        emit('connect_response', {'status': 'connected', 'sid': request.sid})

    @socketio.on('disconnect')
    def handle_disconnect():
        logger.info(f"👋 Desconexión: {request.sid}")

    @socketio.on('search')
    def handle_search(data):
        try:
            logger.info(f"🔍 Búsqueda recibida: {data}")
            timestamp = datetime.now().isoformat()
            
            if not data or 'query' not in data:
                logger.error("❌ Datos de búsqueda inválidos")
                return {'status': 'error', 'message': 'Query no proporcionada'}

            query = data['query']
            user_id = data.get('user_id', request.sid)  # Usar user_id del payload o fallback a sid
            logger.debug(f"📝 Query a procesar: {query} para usuario {user_id}")

            # Obtener servicio preferido del usuario
            preferred_service = search_service.get_user_preference(user_id)
            logger.info(f"⚙️ Servicio preferido: {preferred_service}")

            # Realizar búsqueda
            results = search_service.search_loinc(query, user_id)
            logger.info(f"✅ Resultados encontrados: {len(results)}")

            response = {
                'status': 'success',
                'timestamp': timestamp,
                'service': preferred_service,
                'results': results
            }
            
            logger.debug(f"📤 Enviando respuesta: {response}")
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

    @socketio.on('set_preferred_service')
    def handle_set_preferred_service(data):
        try:
            logger.info(f"⚙️ Configurando servicio preferido: {data}")
            
            if not data or 'service' not in data:
                logger.error("❌ Datos de configuración inválidos")
                return {'status': 'error', 'message': 'Servicio no especificado'}

            service = data['service']
            search_service.set_user_preference(request.sid, service)
            
            response = {
                'status': 'success',
                'message': f'Servicio configurado a {service}',
                'service': service
            }
            
            logger.info(f"✅ Servicio configurado: {response}")
            return response

        except Exception as e:
            logger.error(f"❌ Error al configurar servicio: {str(e)}", exc_info=True)
            return {
                'status': 'error',
                'message': str(e)
            }

    @socketio.on_error()
    def handle_error(e):
        logger.error(f"❌ Error general de WebSocket: {str(e)}", exc_info=True)
        return {
            'status': 'error',
            'message': str(e)
        }

    logger.info("✅ Rutas de WebSocket inicializadas")

# Health Check
@api_routes.route('/api/health')
def health_check():
    """Endpoint para verificar el estado del servidor"""
    try:
        # Obtenemos el user_id del header o query param
        user_id = request.headers.get('X-User-Id') or request.args.get('user_id')
        status = search_service.get_service_status(user_id)
        return jsonify({
            'status': 'ok',
            'message': 'Server is running',
            'services': status
        })
    except Exception as e:
        logging.error(f"Error en health check: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# User Preferences
@api_routes.route('/api/preferences/search', methods=['POST'])
def set_search_preference():
    """Endpoint para configurar el servicio de búsqueda preferido."""
    try:
        user_id = request.headers.get('X-User-Id')
        if not user_id:
            return jsonify({'error': 'X-User-Id header is required'}), 400
            
        service = request.json.get('service')
        if not service or service not in ['elastic', 'sql']:
            return jsonify({'error': 'Invalid service specified'}), 400
            
        if search_service.set_user_preference(user_id, service):
            return jsonify({
                'message': f'Search preference set to {service}',
                'status': search_service.get_service_status(user_id)
            })
        else:
            return jsonify({'error': 'Failed to set preference'}), 500
    except Exception as e:
        logging.error(f"Error configurando preferencia: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# LOINC Routes
@api_routes.route('/api/loinc/search', methods=['GET'])
def search_loinc():
    """Endpoint para buscar en la documentación LOINC."""
    try:
        user_id = request.headers.get('X-User-Id')
        if not user_id:
            return jsonify({'error': 'X-User-Id header is required'}), 400
            
        query = request.args.get('q', '')
        limit = int(request.args.get('limit', 10))
        
        if not query:
            return jsonify({'error': 'Query parameter "q" is required'}), 400
            
        results = search_service.search_loinc(query, user_id, limit)
        return jsonify(results)
    except Exception as e:
        logging.error(f"Error en búsqueda LOINC: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@api_routes.route('/api/loinc/bulk', methods=['POST'])
def bulk_insert_loinc():
    """Endpoint para inserción masiva de documentos LOINC."""
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
        logging.error(f"Error en inserción LOINC: {e}")
        return jsonify({'error': 'Internal server error'}), 500