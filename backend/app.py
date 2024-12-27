import os
import logging
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from services.core.websocket_service import WebSocketService
from services.core.storage_service import StorageService
from services.service_locator import service_locator
from routes.test_routes import test_routes
from routes.app_routes import app_routes
from routes.api_routes import api_routes, init_socket_routes

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

def configure_logging():
    """Configura los niveles de logging para diferentes componentes"""
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    logging.getLogger('engineio').setLevel(logging.WARNING)
    logging.getLogger('socketio').setLevel(logging.WARNING)

def create_app():
    """Crea y configura la aplicación Flask"""
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})
    return app

def init_services(app):
    """Inicializa los servicios core de la aplicación"""
    try:
        logger.info("🚀 Iniciando servicios core...")
        
        # 1. Limpiar servicios anteriores
        service_locator.clear()
        
        # 2. Inicializar WebSocket (necesario para la comunicación)
        websocket = WebSocketService(app)
        service_locator.register('websocket', websocket)
        
        # 3. Inicializar Storage (necesario para datos)
        storage = StorageService()
        service_locator.register('storage', storage)
        
        logger.info("✅ Servicios core inicializados")
        return websocket
        
    except Exception as e:
        logger.error(f"❌ Error inicializando servicios core: {e}")
        raise

def register_routes(app, websocket):
    """Registra todas las rutas de la aplicación"""
    app.register_blueprint(app_routes)
    app.register_blueprint(api_routes)
    
    if os.environ.get('FLASK_ENV') == 'development':
        app.register_blueprint(test_routes)
    
    init_socket_routes(websocket.socketio, service_locator.get('search'))

def run_server(app, websocket):
    """Inicia el servidor según el entorno"""
    if os.environ.get('FLASK_ENV') == 'development':
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

if __name__ == '__main__':
    # Configuración inicial
    configure_logging()
    
    # Crear y configurar app
    app = create_app()
    
    # Inicializar servicios
    websocket = init_services(app)
    
    # Registrar rutas
    register_routes(app, websocket)
    
    # Iniciar servidor
    run_server(app, websocket) 