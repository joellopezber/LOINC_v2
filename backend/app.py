import os
import logging
from flask import Flask
from flask_cors import CORS
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
        # Inicializar todos los servicios core usando el service_locator
        service_locator.initialize_core_services(app)
    except Exception as e:
        logger.error(f"❌ Error inicializando servicios core: {e}")
        raise

def register_routes(app):
    """Registra todas las rutas de la aplicación"""
    try:
        # Registrar blueprints
        app.register_blueprint(app_routes)
        app.register_blueprint(api_routes)
        
        if os.environ.get('FLASK_ENV') == 'development':
            app.register_blueprint(test_routes)
        
        # Obtener websocket service para rutas de socket
        websocket_service = service_locator.get('websocket')
        if websocket_service and websocket_service.socketio:
            init_socket_routes(websocket_service.socketio)
            
        logger.info("✅ Rutas registradas")
    except Exception as e:
        logger.error(f"❌ Error registrando rutas: {e}")
        raise

def run_server(app):
    """Inicia el servidor según el entorno"""
    try:
        websocket_service = service_locator.get('websocket')
        if not websocket_service:
            raise ValueError("WebSocket service no disponible")

        if os.environ.get('FLASK_ENV') == 'development':
            print("\n🚀 Servidor de desarrollo iniciado en http://localhost:5001")
            print("   - Tests Index: http://localhost:5001/tests\n")
            websocket_service.run()
        else:
            print("🚀 Servidor de producción iniciado")
            from gevent import pywsgi
            from geventwebsocket.handler import WebSocketHandler
            server = pywsgi.WSGIServer(('', 5001), app, handler_class=WebSocketHandler)
            server.serve_forever()
    except Exception as e:
        logger.error(f"❌ Error iniciando servidor: {e}")
        raise

def main():
    """Función principal de inicialización"""
    try:
        # Configuración inicial
        configure_logging()
        logger.info("🔧 Logging configurado")
        
        # Crear y configurar app
        app = create_app()
        logger.info("✅ Flask inicializado")
        
        # Inicializar servicios
        init_services(app)
        
        # Registrar rutas
        register_routes(app)
        
        # Iniciar servidor
        run_server(app)
    except Exception as e:
        logger.error(f"❌ Error fatal iniciando aplicación: {e}")
        raise

if __name__ == '__main__':
    main() 