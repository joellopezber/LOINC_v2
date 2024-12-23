import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
from services.websocket_service import WebSocketService
import logging
import os

# Configurar logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__,
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)
CORS(app, resources={r"/*": {"origins": "*"}})

# Inicializar WebSocket
websocket = WebSocketService(app)

@app.route('/')
def index():
    """Ruta principal que renderiza el template"""
    return render_template('index.html')

@app.route('/test')
def test():
    return render_template('test.html')

if __name__ == '__main__':
    print("🚀 Iniciando servidor Flask...")
    print("📍 Accede a la aplicación en: http://localhost:5001")
    websocket.run() 