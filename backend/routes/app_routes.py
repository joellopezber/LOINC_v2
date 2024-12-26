from flask import Blueprint, send_from_directory, render_template, jsonify
import os
import logging

# Configurar logging
logger = logging.getLogger(__name__)

# Obtener la ruta base del proyecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

# Crear Blueprint para rutas de la aplicación
app_routes = Blueprint('app_routes', __name__,
                      template_folder=os.path.join(BASE_DIR, 'frontend/templates'))

def serve_static_file(directory, filename):
    """
    Función auxiliar para servir archivos estáticos de forma segura.
    
    Args:
        directory: Directorio base
        filename: Nombre del archivo
    """
    try:
        return send_from_directory(directory, filename)
    except Exception as e:
        logger.error(f"Error sirviendo archivo estático {filename}: {str(e)}")
        return jsonify({'error': 'File not found'}), 404

# Página principal
@app_routes.route('/')
def serve_index():
    """Sirve la página principal"""
    try:
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error sirviendo index.html: {str(e)}")
        return jsonify({'error': 'Error loading page'}), 500

# Rutas para archivos estáticos
@app_routes.route('/static/css/<path:filename>')
def serve_css(filename):
    """Sirve archivos CSS"""
    return serve_static_file('../frontend/static/css', filename)

@app_routes.route('/static/css/components/<path:filename>')
def serve_css_components(filename):
    """Sirve archivos CSS de componentes"""
    return serve_static_file('../frontend/static/css/components', filename)

@app_routes.route('/static/js/<path:filename>')
def serve_js(filename):
    """Sirve archivos JavaScript"""
    return serve_static_file('../frontend/static/js', filename)

@app_routes.route('/static/js/components/<path:filename>')
def serve_js_components(filename):
    """Sirve archivos JavaScript de componentes"""
    return serve_static_file('../frontend/static/js/components', filename)

@app_routes.route('/static/js/services/<path:filename>')
def serve_js_services(filename):
    """Sirve archivos JavaScript de servicios"""
    return serve_static_file('../frontend/static/js/services', filename)

@app_routes.route('/static/js/utils/<path:filename>')
def serve_js_utils(filename):
    """Sirve archivos JavaScript de utilidades"""
    return serve_static_file('../frontend/static/js/utils', filename)

@app_routes.route('/static/js/test/<path:filename>')
def serve_js_test(filename):
    """Sirve archivos JavaScript de test"""
    return serve_static_file('../frontend/static/js/test', filename) 