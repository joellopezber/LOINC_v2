import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
from services.websocket_service import WebSocketService
from tests.test_openai import handle_test_search
import logging
import os

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'  # Formato simplificado
)

# Ajustar niveles específicos
logging.getLogger('werkzeug').setLevel(logging.WARNING)  # Reducir logs de Flask
logging.getLogger('engineio').setLevel(logging.WARNING)  # Reducir logs de SocketIO
logging.getLogger('socketio').setLevel(logging.WARNING)  # Reducir logs de SocketIO

app = Flask(__name__,
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)
CORS(app, resources={r"/*": {"origins": "*"}})

# Inicializar WebSocket
websocket = WebSocketService(app)

# Registrar manejador de test
@websocket.socketio.on('openai.test_search')
def on_test_search(data):
    """Maneja solicitudes de test de OpenAI"""
    return handle_test_search(data, websocket)

@app.route('/')
def index():
    """Ruta principal que renderiza el template"""
    return render_template('index.html')

@app.route('/test')
def test():
    return render_template('test.html')

@app.route('/tests/test.html')
def serve_test_page():
    return send_from_directory('../frontend/static/tests', 'test.html')

if __name__ == '__main__':
    # Solo mostrar mensajes si se ejecuta directamente
    if os.environ.get('FLASK_DEBUG') != '1':
        print("🚀 Iniciando servidor Flask...")
        print("📍 Accede a la aplicación en: http://localhost:5001")
    websocket.run() 