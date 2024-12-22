from flask import Flask, render_template
from flask_cors import CORS
from services.websocket_service import WebSocketService
import asyncio
import logging

# Configurar logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__,
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configurar loop async para WebSocket
app.async_loop = asyncio.new_event_loop()
asyncio.set_event_loop(app.async_loop)

# Inicializar WebSocket
websocket = WebSocketService(app)

@app.route('/')
def index():
    """Ruta principal que renderiza el template"""
    return render_template('index.html')

if __name__ == '__main__':
    print("🚀 Iniciando servidor Flask...")
    print("📍 Accede a la aplicación en: http://localhost:5001")
    websocket.run() 