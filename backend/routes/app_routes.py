from flask import Blueprint, send_from_directory, render_template
import os

# Obtener la ruta base del proyecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

# Crear Blueprint para rutas de la aplicación
app_routes = Blueprint('app_routes', __name__,
                      template_folder=os.path.join(BASE_DIR, 'frontend/templates'))

# Página principal
@app_routes.route('/')
def serve_index():
    """Sirve la página principal"""
    return render_template('index.html')

# CSS
@app_routes.route('/static/css/<path:filename>')
def serve_css(filename):
    """Sirve archivos CSS"""
    return send_from_directory('../frontend/static/css', filename)

@app_routes.route('/static/css/components/<path:filename>')
def serve_css_components(filename):
    """Sirve archivos CSS de componentes"""
    return send_from_directory('../frontend/static/css/components', filename)

# JavaScript
@app_routes.route('/static/js/<path:filename>')
def serve_js(filename):
    """Sirve archivos JavaScript"""
    return send_from_directory('../frontend/static/js', filename)

@app_routes.route('/static/js/components/<path:filename>')
def serve_js_components(filename):
    """Sirve archivos JavaScript de componentes"""
    return send_from_directory('../frontend/static/js/components', filename)

@app_routes.route('/static/js/services/<path:filename>')
def serve_js_services(filename):
    """Sirve archivos JavaScript de servicios"""
    return send_from_directory('../frontend/static/js/services', filename)

@app_routes.route('/static/js/utils/<path:filename>')
def serve_js_utils(filename):
    """Sirve archivos JavaScript de utilidades"""
    return send_from_directory('../frontend/static/js/utils', filename)

@app_routes.route('/static/js/test/<path:filename>')
def serve_js_test(filename):
    """Sirve archivos JavaScript de test"""
    return send_from_directory('../frontend/static/js/test', filename) 