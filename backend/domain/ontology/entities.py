from dataclasses import dataclass
from typing import List
from datetime import datetime

@dataclass
class AnalysisMetadata:
    """Metadata del análisis"""
    processed_at: datetime
    model_used: str
    confidence_score: float

@dataclass
class AnalysisResult:
    """Resultado del análisis de un término médico"""
    original_term: str
    english_term: str
    search_terms: List[str]
    loinc_codes: List[str]
    metadata: AnalysisMetadata
    success: bool = True
    error: str = ""

    @property
    def is_valid(self) -> bool:
        """Verifica si el resultado es válido"""
        return self.success and bool(self.loinc_codes) 