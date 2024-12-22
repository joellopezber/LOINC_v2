import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from flask import Flask
from api.ontology import ontology_bp
import json

@pytest.fixture
def app():
    """Fixture que proporciona una instancia de Flask para testing"""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.register_blueprint(ontology_bp)
    return app

@pytest.fixture
def mock_service_response():
    """Fixture que proporciona una respuesta mockeada del servicio"""
    return {
        'success': True,
        'term': 'hemoglobina glucosilada',
        'search_terms': ['glycated hemoglobin', 'HbA1c'],
        'loinc_codes': ['4548-4'],
        'metadata': {
            'processed_at': '2024-01-01T00:00:00'
        }
    }

@pytest.mark.asyncio
class TestOntologyAPI:
    """Tests para el endpoint de ontología"""

    @pytest.mark.asyncio
    async def test_analyze_term_success(self, app, mock_service_response):
        """Test llamada exitosa al endpoint"""
        with patch('api.ontology.ontology_service') as mock_service:
            mock_service.analyze_term = AsyncMock(return_value={
                'success': True,
                'data': {
                    'term_in_english': 'glycated hemoglobin'
                }
            })
            mock_service.process_results = AsyncMock(return_value=mock_service_response)

            client = app.test_client()
            response = await client.post('/api/ontology/analyze', json={
                'term': 'hemoglobina glucosilada'
            })
            
            assert response.status_code == 200
            data = json.loads(response.data)
            
            assert data['success'] is True
            assert 'search_terms' in data
            assert 'loinc_codes' in data
            assert 'metadata' in data

    @pytest.mark.asyncio
    async def test_analyze_term_missing_term(self, app):
        """Test error cuando falta el término"""
        client = app.test_client()
        response = await client.post('/api/ontology/analyze', json={})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
        assert 'Se requiere un término' in data['error']

    @pytest.mark.asyncio
    async def test_analyze_term_empty_term(self, app):
        """Test error cuando el término está vacío"""
        client = app.test_client()
        response = await client.post('/api/ontology/analyze', json={
            'term': ''
        })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data

    @pytest.mark.asyncio
    async def test_analyze_term_service_error(self, app):
        """Test manejo de error del servicio"""
        with patch('api.ontology.ontology_service') as mock_service:
            mock_service.analyze_term = AsyncMock(return_value={
                'success': False,
                'error': 'Error en el servicio'
            })

            client = app.test_client()
            response = await client.post('/api/ontology/analyze', json={
                'term': 'test'
            })
            
            assert response.status_code == 500
            data = json.loads(response.data)
            
            assert data['success'] is False
            assert 'error' in data

    @pytest.mark.asyncio
    async def test_analyze_term_invalid_json(self, app):
        """Test error con JSON inválido"""
        client = app.test_client()
        response = await client.post('/api/ontology/analyze', 
            data='invalid json',
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
  