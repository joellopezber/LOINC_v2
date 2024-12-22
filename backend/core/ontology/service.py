import logging
from typing import Dict, Optional
import json
from datetime import datetime
from ..ai.client import ai_client

logger = logging.getLogger(__name__)

class OntologyService:
    _instance = None

    @classmethod
    def get_instance(cls):
        """Obtiene la instancia del servicio (singleton)"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.logger = logging.getLogger('backend.core.ontology.service')
        self._ai_client = ai_client

    async def analyze_term(self, term: str) -> Dict:
        """Analiza un término médico usando IA"""
        try:
            self.logger.info(f"🔍 Analizando término: {term}")
            
            # Configurar prompts
            system_prompt = (
                "Eres un experto en terminología médica y LOINC. "
                "Analiza el término proporcionado y extrae información relevante "
                "para búsqueda en LOINC."
            )
            
            user_prompt = (
                f"Analiza el siguiente término médico:\n{term}\n\n"
                "Responde en formato JSON con:\n"
                "{\n"
                '  "term_in_english": "término en inglés",\n'
                '  "related_terms": ["término1", "término2"],\n'
                '  "test_types": ["tipo1", "tipo2"],\n'
                '  "loinc_codes": ["código1", "código2"],\n'
                '  "keywords": ["palabra1", "palabra2"]\n'
                "}"
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            # Llamar a OpenAI
            response = await self._ai_client.create_chat_completion(
                messages=messages,
                temperature=0.7
            )

            # Procesar respuesta
            content = response.choices[0].message.content
            json_result = json.loads(content)

            return {
                "success": True,
                "data": json_result,
                "metadata": {
                    "processed_at": datetime.now().isoformat(),
                    "model": response.model
                }
            }

        except Exception as e:
            self.logger.error(f"❌ Error analizando término: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def process_results(self, term: str, analysis_result: Dict) -> Dict:
        """Procesa los resultados del análisis"""
        try:
            if not analysis_result.get("success"):
                return analysis_result

            data = analysis_result["data"]
            
            # Recopilar términos de búsqueda
            search_terms = set()
            search_terms.add(data.get("term_in_english", ""))
            search_terms.update(data.get("related_terms", []))
            search_terms.update(data.get("test_types", []))
            search_terms.update(data.get("keywords", []))

            # Eliminar términos vacíos
            search_terms = {t for t in search_terms if t}

            return {
                "success": True,
                "term": term,
                "search_terms": list(search_terms),
                "loinc_codes": data.get("loinc_codes", []),
                "metadata": {
                    "processed_at": datetime.now().isoformat(),
                    "original_analysis": analysis_result.get("metadata", {})
                }
            }

        except Exception as e:
            self.logger.error(f"❌ Error procesando resultados: {e}")
            return {
                "success": False,
                "error": str(e)
            }

# Instancia global
ontology_service = OntologyService() 