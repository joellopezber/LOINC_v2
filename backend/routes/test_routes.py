from flask import Blueprint, send_from_directory, jsonify

# Crear Blueprint para rutas de test
test_routes = Blueprint('test_routes', __name__)

@test_routes.route('/tests/api/health')
def health_check():
    """Endpoint para verificar el estado del servidor en tests"""
    return jsonify({
        'status': 'ok',
        'message': 'Test server is running'
    })

@test_routes.route('/tests/<path:filename>')
def serve_tests(filename):
    """Sirve archivos de test desde frontend/tests"""
    return send_from_directory('../frontend/tests', filename)

@test_routes.route('/tests')
def serve_test_index():
    """Sirve la página principal de tests"""
    return send_from_directory('../frontend/tests', 'index.html')

@test_routes.route('/tests/manual/services/openai')
def serve_test_openai():
    """Sirve la página de test de OpenAI"""
    return send_from_directory('../frontend/tests/manual/services', 'openai.html')

@test_routes.route('/tests/manual/services/ontology')
def serve_test_ontology():
    """Sirve la página de test de Ontology"""
    return send_from_directory('../frontend/tests/manual/services', 'ontology.html') 