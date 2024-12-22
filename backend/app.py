from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
import os
from routes.prompts import prompts_bp
from api.ontology import ontology_bp
from api.config import config_bp

app = Flask(__name__, 
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)
CORS(app)

# Registrar blueprints
app.register_blueprint(prompts_bp)
app.register_blueprint(ontology_bp)
app.register_blueprint(config_bp)

@app.route('/')
def index():
    """Ruta principal que renderiza el template"""
    return render_template('index.html')

if __name__ == '__main__':
    print("🚀 Iniciando servidor Flask...")
    print("📍 Accede a la aplicación en: http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=True) 