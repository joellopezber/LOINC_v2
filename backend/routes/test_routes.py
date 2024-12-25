from flask import Blueprint, send_from_directory

# Crear Blueprint para rutas de test
test_routes = Blueprint('test_routes', __name__)

@test_routes.route('/tests/<path:filename>')
def serve_tests(filename):
    """Sirve archivos de test desde frontend/static/tests"""
    return send_from_directory('../frontend/static/tests', filename)

@test_routes.route('/test')
def serve_test_index():
    """Sirve la página principal de tests"""
    return send_from_directory('../frontend/static/tests', 'test.html')

@test_routes.route('/test/openai')
def serve_test_openai():
    """Sirve la página de test de OpenAI"""
    return send_from_directory('../frontend/static/tests', 'test_openai.html')

@test_routes.route('/test/ontology')
def serve_test_ontology():
    """Sirve la página de test de Ontology"""
    return send_from_directory('../frontend/static/tests', 'test_ontology.html') 