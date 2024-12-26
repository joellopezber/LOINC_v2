import os
import logging
from flask import Flask
from flask_cors import CORS
from services.websocket_service import WebSocketService
from services.search_service import SearchService
from tests.test_openai import handle_test_search
from tests.test_ontology import handle_ontology_search
from routes.test_routes import test_routes
from routes.app_routes import app_routes
from routes.api_routes import api_routes, init_socket_routes

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)

# Ajustar niveles específicos
logging.getLogger('werkzeug').setLevel(logging.WARNING)
logging.getLogger('engineio').setLevel(logging.WARNING)
logging.getLogger('socketio').setLevel(logging.WARNING)

# Determinar el modo de ejecución
IS_DEVELOPMENT = os.environ.get('FLASK_ENV') == 'development'

if IS_DEVELOPMENT:
    # Configuración para desarrollo
    import eventlet
    eventlet.monkey_patch()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Inicializar WebSocket
websocket = WebSocketService(app)

# Registrar rutas
app.register_blueprint(app_routes)  # Rutas principales siempre activas
app.register_blueprint(api_routes)  # Rutas API

# Registrar rutas de test solo en desarrollo
if IS_DEVELOPMENT:
    app.register_blueprint(test_routes)

# Inicializar rutas de WebSocket
init_socket_routes(websocket.socketio, websocket.search_service)

# Registrar manejadores de WebSocket
@websocket.socketio.on('openai.test_search')
def on_test_search(data):
    """Maneja solicitudes de test de OpenAI"""
    return handle_test_search(data, websocket)

@websocket.socketio.on('ontology.search')
def on_ontology_search(data):
    """Maneja solicitudes de búsqueda ontológica"""
    return handle_ontology_search(data, websocket)

if __name__ == '__main__':
    if IS_DEVELOPMENT:
        print("\n🚀 Servidor de desarrollo iniciado en http://localhost:5001")
        print("\n📝 Tests disponibles en:")
        print("   - Tests Index: http://localhost:5001/tests")
        websocket.run()
    else:
        print("🚀 Servidor de producción iniciado")
        from gevent import pywsgi
        from geventwebsocket.handler import WebSocketHandler
        server = pywsgi.WSGIServer(('', 5001), app, handler_class=WebSocketHandler)
        server.serve_forever() 