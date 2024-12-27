import os
import logging
from typing import Optional, Dict, Any
from .openai_service import OpenAIService

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Prompt por defecto
DEFAULT_SYSTEM_PROMPT = """You are a clinical laboratory expert with deep knowledge of LOINC codes and medical terminology. 
Your task is to analyze a given clinical laboratory term in English, utilizing your knowledge of LOINC codes and medical terminology.

### Language Handling:
1. The input term can be in one of the following languages: Catalan, Spanish, French, or English
2. If the input term is in English, do not translate it
3. If the input term is in Catalan, Spanish, or French, translate it into English before starting the analysis

### Handling of Input Terms Referring to Tests and Test Groups:
The input term may refer to either a single test or a group of tests. Analyze and identify all relevant tests and their subcomponents as needed.
If the input refers to a group of tests, identify and include all associated tests and related analyses.

### Analysis Steps:
1. **reflection**: Given that the term is a laboratory test or a set of tests in Catalan, it is likely that a literal translation is difficult to find in LOINC. Therefore, we must identify all variables to determine the keywords and search the LOINC database.
2. **term_in_english**: Translate the term to English using a standard medical terminology database. Return only one accurate and accepted translation, without synonyms or variants.
3. **related_terms**: Given the term, identify related terms. Include alternative names, acronyms, common usage variants, and medical or laboratory terms that are directly or indirectly linked to the main concept.
4. **test_types**: Given the term, identify associated laboratory test names. Include common and official test names used to measure, analyze, or diagnose the term.
5. **loinc_codes**: Given the term, search the LOINC database for all laboratory observation codes corresponding to tests for this term. Include only LOINCs directly associated with the test.
6. **keywords**: List of all keywords related to the term, which should be derived from the terms included in the previous sections. These keywords must follow these strict rules:
    - Keywords must be individual words
    - Include important synonyms, common names, acronyms, scientific terms
    - Each keyword must have been previously mentioned
    - Keywords must allow unique identification of the clinical concept

### Response Format (JSON):
{
    "term_in_english": "translated term or original if already in English",
    "related_terms": [
        "list of related terms in English"
    ],
    "test_types": [
        "list of laboratory tests (do not include the word test)"
    ],
    "loinc_codes": {
        "code1": {
            "code": "2345-7",
            "component": "Glucose",
            "property": "Mass/volume",
            "time": "Point in time",
            "system": "Blood",
            "scale": "Quantitative",
            "method": ""
        },
        "code2": {
            "code": "2339-0",
            "component": "Glucose",
            "property": "Mass/volume",
            "time": "Point in time",
            "system": "Serum/Plasma",
            "scale": "Quantitative",
            "method": ""
        }
    },
    "keywords": [
        "list of specific laboratory terms for search"
    ]
}

### Important Rules:
1. ALL output must be in English
2. Test types should be concise (no "test" or "analysis" words unless part of official name)
3. Include LOINC codes with full LOINC parts (component, property, time, system, scale, method)
4. Related terms should focus on laboratory terms
5. Keywords should be specific laboratory terms
6. If the security is defined in a group, clearly specify that the combination is detrimental to the security
7. Identify all the key words that you need to categorize or stop the terminus"""

class OntologyService:
    def __init__(self):
        """Inicializa el servicio de ontología"""
        logger.info("🔍 Servicio de Ontología creado")

    def _validate_response(self, response: str) -> bool:
        """
        Valida que la respuesta tenga el formato JSON esperado
        Args:
            response: Respuesta de OpenAI
        Returns:
            bool: True si la respuesta es válida
        """
        try:
            import json
            data = json.loads(response)
            
            # Validar campos requeridos
            required_fields = [
                'term_in_english',
                'related_terms',
                'test_types',
                'loinc_codes',
                'keywords'
            ]
            
            for field in required_fields:
                if field not in data:
                    logger.error(f"❌ Falta campo requerido: {field}")
                    return False
                    
            return True
            
        except json.JSONDecodeError:
            logger.error("❌ Respuesta no es JSON válido")
            return False
        except Exception as e:
            logger.error(f"❌ Error validando respuesta: {str(e)}")
            return False

    def process_term(
        self, 
        term: str,
        model: str = "gpt-4o",
        temperature: float = 0.5
    ) -> Optional[str]:
        """
        Procesa un término médico usando OpenAI para obtener información estructurada
        Args:
            term: Término médico a analizar
            model: Modelo de OpenAI a usar (default: gpt-4o)
            temperature: Temperatura para la respuesta (default: 0.5)
        Returns:
            Respuesta de OpenAI o None si hay error
        """
        try:
            logger.info("=" * 50)
            logger.info("🔍 INICIO PROCESO DE TÉRMINO")
            logger.info(f"📝 Término recibido: '{term}'")
            logger.info(f"⚙️ Configuración: model={model}, temperature={temperature}")

            # Validar término
            if not term or not isinstance(term, str):
                logger.error("❌ Término inválido")
                logger.error(f"Tipo recibido: {type(term)}")
                logger.error(f"Valor recibido: {term}")
                return None

            # Construir el prompt
            user_prompt = f"""Analyze the following medical term and provide relevant information for LOINC search:
            Term: {term}"""
            logger.info("📋 User Prompt construido:")
            logger.info("-" * 40)
            logger.info(user_prompt)
            logger.info("-" * 40)

            # Obtener instancia de OpenAI Service
            logger.info("🔄 Obteniendo OpenAIService...")
            from .service_locator import ServiceLocator
            openai_service = ServiceLocator.get_instance().get_service('openai')
            
            if not openai_service:
                logger.error("❌ No se pudo obtener OpenAIService")
                return None
            
            logger.info("✅ OpenAIService obtenido correctamente")

            # Procesar con OpenAI
            logger.info("🚀 Enviando solicitud a OpenAI...")
            response = openai_service.process_query(
                user_prompt=user_prompt,
                model=model,
                temperature=temperature,
                system_prompt=DEFAULT_SYSTEM_PROMPT
            )

            if not response:
                logger.error("❌ No se obtuvo respuesta de OpenAI")
                return None

            logger.info("📩 Respuesta recibida de OpenAI")
            
            # Validar formato de respuesta
            logger.info("🔍 Validando formato de respuesta...")
            if not self._validate_response(response):
                logger.error("❌ Formato de respuesta inválido")
                return None

            logger.info("✅ Respuesta validada correctamente")
            logger.debug(f"📩 Primeros 100 caracteres: {response[:100]}...")
            logger.info("✅ TÉRMINO PROCESADO EXITOSAMENTE")
            logger.info("=" * 50)
            return response

        except Exception as e:
            logger.error("=" * 50)
            logger.error("❌ ERROR EN PROCESO DE TÉRMINO")
            logger.error(f"Tipo de error: {type(e).__name__}")
            logger.error(f"Mensaje: {str(e)}")
            logger.exception("Detalles del error:")
            logger.error("=" * 50)
            return None

# Crear instancia global
ontology_service = OntologyService() 