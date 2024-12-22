from flask import Blueprint, request, jsonify
import asyncio
from core.ontology.service import ontology_service
from typing import Tuple, Dict, Any
import logging

logger = logging.getLogger(__name__)
ontology_bp = Blueprint('ontology', __name__)

class AnalysisError(Exception):
    """Excepción personalizada para errores de análisis"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

def validate_term(term: str) -> None:
    """Valida el término de búsqueda"""
    if not term:
        raise AnalysisError("Se requiere un término para analizar", 400)
    if not isinstance(term, str):
        raise AnalysisError("El término debe ser una cadena de texto", 400)
    if len(term.strip()) == 0:
        raise AnalysisError("El término no puede estar vacío", 400)

def run_async(coroutine) -> Any:
    """Ejecuta una corutina en un nuevo event loop"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coroutine)
    finally:
        loop.close()

async def analyze_term_async(term: str) -> Tuple[Dict, int]:
    """Procesa el término de forma asíncrona"""
    # Analizar término
    analysis_result = await ontology_service.analyze_term(term)
    if not analysis_result['success']:
        return analysis_result, 500

    # Procesar resultados
    processed_result = await ontology_service.process_results(term, analysis_result)
    return processed_result, 200

@ontology_bp.route('/api/ontology/analyze', methods=['POST'])
def analyze_term_endpoint() -> Tuple[Dict, int]:
    """Endpoint para analizar términos médicos"""
    try:
        # Validar request
        data = request.get_json()
        if not data:
            raise AnalysisError("Se requiere un JSON válido", 400)
        
        # Validar término
        term = data.get('term')
        validate_term(term)
        
        # Procesar término
        result, status_code = run_async(analyze_term_async(term))
        return jsonify(result), status_code

    except AnalysisError as e:
        logger.warning(f"⚠️ Error de validación: {e.message}")
        return jsonify({
            'success': False,
            'error': e.message
        }), e.status_code
        
    except Exception as e:
        logger.error(f"❌ Error inesperado en /analyze: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': "Error interno del servidor"
        }), 500