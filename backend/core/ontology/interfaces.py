from abc import ABC, abstractmethod
from typing import Dict, Any
from domain.ontology.entities import AnalysisResult

class OntologyServicePort(ABC):
    """Puerto para el servicio de ontología"""
    
    @abstractmethod
    async def analyze_term(self, term: str) -> AnalysisResult:
        """Analiza un término médico"""
        pass

    @abstractmethod
    async def translate_term(self, term: str) -> str:
        """Traduce un término al inglés"""
        pass

    @abstractmethod
    async def find_loinc_codes(self, term: str) -> Dict[str, Any]:
        """Busca códigos LOINC para un término"""
        pass 