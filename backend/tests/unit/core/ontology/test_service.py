import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from core.ontology.service import OntologyService
import json

@pytest.mark.asyncio
class TestOntologyService:
    """Tests para el servicio de ontología"""

    @pytest.fixture
    def mock_ai_client(self):
        """Fixture que proporciona un cliente AI mockeado"""
        mock_client = MagicMock()
        mock_client.create_chat_completion = AsyncMock(return_value=MagicMock(
            choices=[
                MagicMock(
                    message=MagicMock(
                        content=json.dumps({
                            "term_in_english": "glycated hemoglobin",
                            "related_terms": ["HbA1c", "hemoglobin A1c"],
                            "test_types": ["blood test", "diabetes monitoring"],
                            "loinc_codes": ["4548-4"],
                            "keywords": ["diabetes", "glucose", "monitoring"]
                        })
                    )
                )
            ],
            model="gpt-4"
        ))
        return mock_client

    async def test_analyze_term_success(self, mock_ai_client):
        """Test análisis exitoso de término"""
        with patch('core.ontology.service.ai_client', mock_ai_client):
            service = OntologyService()
            result = await service.analyze_term("hemoglobina glucosilada")
            
            assert result["success"] is True
            assert "data" in result
            assert "metadata" in result
            
            data = result["data"]
            assert data["term_in_english"] == "glycated hemoglobin"
            assert "HbA1c" in data["related_terms"]
            assert "4548-4" in data["loinc_codes"]

    async def test_analyze_term_error(self, mock_ai_client):
        """Test manejo de error en análisis"""
        mock_ai_client.create_chat_completion.side_effect = Exception("API Error")
        
        with patch('core.ontology.service.ai_client', mock_ai_client):
            service = OntologyService()
            result = await service.analyze_term("test")
            
            assert result["success"] is False
            assert "error" in result
            assert "API Error" in result["error"]

    async def test_process_results_success(self):
        """Test procesamiento exitoso de resultados"""
        service = OntologyService()
        analysis_result = {
            "success": True,
            "data": {
                "term_in_english": "glycated hemoglobin",
                "related_terms": ["HbA1c"],
                "test_types": ["blood test"],
                "loinc_codes": ["4548-4"],
                "keywords": ["diabetes"]
            },
            "metadata": {
                "model": "gpt-4"
            }
        }

        result = await service.process_results(
            "hemoglobina glucosilada",
            analysis_result
        )

        assert result["success"] is True
        assert result["term"] == "hemoglobina glucosilada"
        assert "glycated hemoglobin" in result["search_terms"]
        assert "HbA1c" in result["search_terms"]
        assert "4548-4" in result["loinc_codes"]
        assert "metadata" in result

    async def test_process_results_with_failed_analysis(self):
        """Test procesamiento con análisis fallido"""
        service = OntologyService()
        failed_result = {
            "success": False,
            "error": "Error en análisis"
        }

        result = await service.process_results("test", failed_result)
        
        assert result["success"] is False
        assert result["error"] == "Error en análisis"

    async def test_process_results_with_empty_terms(self):
        """Test procesamiento con términos vacíos"""
        service = OntologyService()
        analysis_result = {
            "success": True,
            "data": {
                "term_in_english": "",
                "related_terms": [""],
                "test_types": [],
                "loinc_codes": [],
                "keywords": [""]
            }
        }

        result = await service.process_results("test", analysis_result)
        
        assert result["success"] is True
        assert len(result["search_terms"]) == 0
        assert len(result["loinc_codes"]) == 0