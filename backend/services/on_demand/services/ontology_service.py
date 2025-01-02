import logging
from typing import Dict, Any, Optional
from ...lazy_load_service import LazyLoadService, lazy_load
from ...service_locator import service_locator

logger = logging.getLogger(__name__)

# Valores por defecto
DEFAULT_MODEL = "gpt-4o"
DEFAULT_TEMPERATURE = 0.7
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

class OntologyService(LazyLoadService):
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OntologyService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio de ontología"""
        if hasattr(self, '_initialized'):
            return
            
        super().__init__()
        logger.debug("🔍 Inicializando Ontology service")
        
        try:
            self._openai_service = None
            self._storage = None
            self._set_initialized(True)
        except Exception as e:
            self._set_initialized(False, str(e))
            raise

    @property
    @lazy_load('openai')
    def openai_service(self):
        """Obtiene el OpenAIService de forma lazy"""
        return self._openai_service

    @property
    @lazy_load('storage')
    def storage(self):
        """Obtiene el StorageService de forma lazy"""
        return self._storage

    def process_query(
        self, 
        user_prompt: str,
        install_id: str,
        model: str = DEFAULT_MODEL,
        temperature: float = DEFAULT_TEMPERATURE,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT
    ) -> Optional[Dict[str, Any]]:
        """
        Procesa un término médico usando OpenAI para obtener información estructurada
        Args:
            user_prompt: Término médico a analizar
            install_id: ID de instalación del usuario
            model: Modelo de OpenAI a usar
            temperature: Temperatura para la respuesta
            system_prompt: Prompt de sistema personalizado
        Returns:
            Dict con la información estructurada o None si hay error
        """
        try:
            logger.debug("🔄 Iniciando proceso de término médico")
            logger.debug(f"👤 Término: {user_prompt}")
            logger.debug(f"🤖 Modelo: {model}")
            logger.debug(f"🌡️ Temperatura: {temperature}")
            
            # Validar inicialización
            if not self.initialized:
                logger.error("❌ Servicio no inicializado")
                return None

            # Validar término
            if not user_prompt or not isinstance(user_prompt, str):
                logger.error("❌ Término inválido")
                return None

            # Procesar con OpenAI usando lazy loading
            if not self.openai_service:
                logger.error("❌ OpenAI service no disponible")
                return None
            
            # Procesar con OpenAI
            response = self.openai_service.process_query(
                user_prompt=user_prompt,
                install_id=install_id,
                model=model,
                temperature=temperature,
                system_prompt=system_prompt
            )

            if not response:
                logger.error("❌ No se obtuvo respuesta de OpenAI")
                return None
                
            logger.debug(f"📩 Respuesta recibida: {response[:200]}...")
            
            # Validar formato de respuesta
            try:
                # Limpiar respuesta para asegurar JSON válido
                response = response.strip()
                if response.startswith('```json'):
                    response = response[7:]
                if response.endswith('```'):
                    response = response[:-3]
                response = response.strip()
                
                logger.debug(f"🔄 Parseando JSON limpio: {response[:200]}...")
                
                # Parsear respuesta JSON
                import json
                data = json.loads(response)
                
                # Validar campos requeridos
                required_fields = ['term_in_english', 'related_terms', 'test_types', 'loinc_codes', 'keywords']
                for field in required_fields:
                    if field not in data:
                        logger.error(f"❌ Falta campo requerido: {field}")
                        return None
                    
                # Validar tipos de datos
                if not isinstance(data['term_in_english'], str):
                    logger.error("❌ term_in_english debe ser string")
                    return None
                    
                if not isinstance(data['related_terms'], list):
                    logger.error("❌ related_terms debe ser lista")
                    return None
                    
                if not isinstance(data['test_types'], list):
                    logger.error("❌ test_types debe ser lista")
                    return None
                    
                if not isinstance(data['loinc_codes'], dict):
                    logger.error("❌ loinc_codes debe ser diccionario")
                    return None
                    
                if not isinstance(data['keywords'], list):
                    logger.error("❌ keywords debe ser lista")
                    return None
                
                # Añadir el término original
                enriched_data = {
                    "original_term": user_prompt,
                    **data
                }
                
                logger.debug("✅ Término procesado correctamente")
                return enriched_data
                
            except json.JSONDecodeError as e:
                logger.error(f"❌ Error parseando JSON: {str(e)}")
                logger.error(f"📝 Respuesta recibida: {response}")
                return None
            except Exception as e:
                logger.error(f"❌ Error procesando término: {str(e)}")
                return None

        except Exception as e:
            logger.error(f"❌ Error en proceso de término: {str(e)}")
            return None

# Instancia global
ontology_service = OntologyService() 