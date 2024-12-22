from flask import Blueprint, request, jsonify
import asyncio
from typing import Dict, Any
import logging
from core.ontology.use_cases import AnalyzeTermUseCase
from core.ontology.exceptions import AnalysisError, DomainError
from infrastructure.services.ontology import OntologyService

# Configuración
logger = logging.getLogger(__name__)
ontology_bp = Blueprint('ontology', __name__)

# Inyección de dependencias
ontology_service = OntologyService()
analyze_term_use_case = AnalyzeTermUseCase(ontology_service)

def run_async(coroutine: Any) -> Any:
    """Ejecuta una corutina en un nuevo event loop"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coroutine)
    finally:
        loop.close()

@ontology_bp.route('/api/ontology/analyze', methods=['POST'])
def analyze_term_endpoint() -> tuple[Dict[str, Any], int]:
    """Endpoint para analizar términos médicos"""
    try:
        # Validar request
        data = request.get_json()
        if not data:
            raise AnalysisError("Se requiere un JSON válido", 400)
        
        # Obtener término
        term = data.get('term')
        
        # Ejecutar caso de uso
        result = run_async(analyze_term_use_case.execute(term))
        
        # Convertir resultado a diccionario
        response = {
            'success': True,
            'term': result.original_term,
            'search_terms': result.search_terms,
            'loinc_codes': result.loinc_codes,
            'metadata': {
                'processed_at': result.metadata.processed_at.isoformat(),
                'model': result.metadata.model_used,
                'confidence': result.metadata.confidence_score
            }
        }
        
        return jsonify(response), 200

    except AnalysisError as e:
        logger.warning(f"⚠️ Error de análisis: {e.message}")
        return jsonify({
            'success': False,
            'error': e.message
        }), e.status_code
        
    except DomainError as e:
        logger.error(f"❌ Error de dominio: {e.message}")
        return jsonify({
            'success': False,
            'error': e.message
        }), 500
        
    except Exception as e:
        logger.error(f"❌ Error inesperado: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': "Error interno del servidor"
        }), 500 