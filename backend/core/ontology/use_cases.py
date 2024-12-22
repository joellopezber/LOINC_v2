from typing import Protocol
from domain.ontology.entities import AnalysisResult
from .interfaces import OntologyServicePort
from .exceptions import AnalysisError

class AnalyzeTermUseCase:
    """Caso de uso para analizar términos médicos"""

    def __init__(self, ontology_service: OntologyServicePort):
        self._service = ontology_service

    def _validate_term(self, term: str) -> None:
        """Valida el término de entrada"""
        if not term:
            raise AnalysisError("Se requiere un término para analizar", 400)
        if not isinstance(term, str):
            raise AnalysisError("El término debe ser una cadena de texto", 400)
        if len(term.strip()) == 0:
            raise AnalysisError("El término no puede estar vacío", 400)

    async def execute(self, term: str) -> AnalysisResult:
        """Ejecuta el análisis del término"""
        try:
            # Validar entrada
            self._validate_term(term)

            # Analizar término
            result = await self._service.analyze_term(term)
            
            # Validar resultado
            if not result.is_valid:
                raise AnalysisError(
                    result.error or "No se encontraron códigos LOINC", 
                    500
                )

            return result

        except AnalysisError:
            raise
        except Exception as e:
            raise AnalysisError(f"Error al analizar el término: {str(e)}", 500) 