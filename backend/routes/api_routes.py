from flask import Blueprint, request, jsonify, redirect, send_from_directory
import logging
from flask_socketio import emit
from datetime import datetime
from services.service_locator import service_locator
import os

# Configurar logging
logger = logging.getLogger(__name__)

# Crear Blueprint para rutas API
api_routes = Blueprint('api_routes', __name__)

@api_routes.route('/tests')
def redirect_tests():
    """Redirecciona /tests a /tests/index.html"""
    return redirect('/tests/index.html')

@api_routes.route('/manual/css/<path:filename>')
def serve_test_css(filename):
    """Sirve archivos CSS de test"""
    test_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'frontend', 'tests', 'manual', 'css')
    return send_from_directory(test_dir, filename)

@api_routes.route('/manual/js/<path:filename>')
def serve_test_js(filename):
    """Sirve archivos JS de test"""
    test_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'frontend', 'tests', 'manual', 'js')
    return send_from_directory(test_dir, filename)

def get_search_service():
    """
    Obtiene el servicio de búsqueda de forma lazy
    
    Returns:
        DatabaseSearchService: Instancia del servicio
    """
    return service_locator.get('database_search')

_socket_routes_initialized = False

def init_socket_routes(socketio):
    """Inicializa las rutas de WebSocket"""
    global _socket_routes_initialized
    
    # Evitar inicialización duplicada
    if _socket_routes_initialized:
        return
        
    try:
        # Registrar handlers on-demand
        service_locator.register_on_demand_handlers(socketio)
        _socket_routes_initialized = True
        
    except Exception as e:
        logger.error(f"❌ Error inicializando rutas WebSocket: {e}")
        raise

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
            'message': 'Server is running',
            'services': service_locator.get_service_status()
        })
    except Exception as e:
        logger.error(f"Error en health check: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@api_routes.route('/api/loinc/search', methods=['GET'])
def search_loinc():
    """Endpoint para búsqueda LOINC"""
    try:
        user_id = request.headers.get('X-User-Id')
        if not user_id:
            return jsonify({'error': 'X-User-Id header is required'}), 400
            
        query = request.args.get('q')
        if not query:
            return jsonify({'error': 'Query parameter "q" is required'}), 400
            
        limit = int(request.args.get('limit', 10))
        search_service = get_search_service()
        if not search_service:
            return jsonify({'error': 'Search service not available'}), 503
            
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
            
        search_service = get_search_service()
        if not search_service:
            return jsonify({'error': 'Search service not available'}), 503
            
        status = search_service.bulk_insert_docs(docs, user_id)
        
        if status['success']:
            return jsonify(status)
        else:
            return jsonify({'error': status.get('error', 'Unknown error')}), 500
            
    except Exception as e:
        logger.error(f"Error en inserción masiva LOINC: {e}")
        return jsonify({'error': str(e)}), 500