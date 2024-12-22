from datetime import datetime
from typing import Dict, Any, List
import openai
from core.ontology.interfaces import OntologyServicePort
from core.ontology.exceptions import ServiceError
from domain.ontology.entities import AnalysisResult, AnalysisMetadata

class OntologyService(OntologyServicePort):
    """Implementación del servicio de ontología usando OpenAI"""

    def __init__(self, model: str = "gpt-4"):
        self.model = model
        self._setup_client()

    def _setup_client(self) -> None:
        """Configura el cliente de OpenAI"""
        try:
            # La key se obtiene de variables de entorno
            self.client = openai.OpenAI()
        except Exception as e:
            raise ServiceError("Error al configurar OpenAI", e)

    async def translate_term(self, term: str) -> str:
        """Traduce un término al inglés"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres un traductor médico experto."},
                    {"role": "user", "content": f"Traduce este término médico al inglés: {term}"}
                ]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            raise ServiceError(f"Error al traducir término: {str(e)}", e)

    async def find_loinc_codes(self, term: str) -> Dict[str, Any]:
        """Busca códigos LOINC para un término"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres un experto en LOINC."},
                    {"role": "user", "content": f"Encuentra códigos LOINC para: {term}"}
                ]
            )
            # Aquí iría la lógica para parsear la respuesta y extraer los códigos
            # Por ahora retornamos un mock
            return {
                "codes": ["4548-4"],
                "terms": ["Hemoglobin A1c"]
            }
        except Exception as e:
            raise ServiceError(f"Error al buscar códigos LOINC: {str(e)}", e)

    async def analyze_term(self, term: str) -> AnalysisResult:
        """Analiza un término médico"""
        try:
            # Traducir término
            english_term = await self.translate_term(term)
            
            # Buscar códigos LOINC
            loinc_data = await self.find_loinc_codes(english_term)
            
            # Crear metadata
            metadata = AnalysisMetadata(
                processed_at=datetime.now(),
                model_used=self.model,
                confidence_score=0.95  # Mock
            )
            
            # Crear resultado
            return AnalysisResult(
                original_term=term,
                english_term=english_term,
                search_terms=loinc_data["terms"],
                loinc_codes=loinc_data["codes"],
                metadata=metadata
            )
            
        except Exception as e:
            if isinstance(e, ServiceError):
                raise
            raise ServiceError(f"Error en el análisis: {str(e)}", e) 