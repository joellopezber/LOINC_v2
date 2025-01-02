import logging
from typing import Dict, Any, List, Optional
from ...lazy_load_service import LazyLoadService, lazy_load
from ...service_locator import service_locator

logger = logging.getLogger(__name__)

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
            self._openai = None
            self._storage = None
            self._set_initialized(True)
        except Exception as e:
            self._set_initialized(False, str(e))
            raise

    @property
    def openai_service(self):
        """Obtiene el OpenAIService"""
        if not self._openai_service:
            self._openai_service = service_locator.get('openai')
            if not self._openai_service:
                logger.error("❌ No se pudo obtener OpenAIService del service_locator")
                return None
            logger.info("✅ OpenAIService obtenido del service_locator")
        return self._openai_service

    def _clean_json_response(self, response: str) -> str:
        """
        Limpia la respuesta de OpenAI para obtener un JSON válido
        1. Elimina los bloques de código markdown
        2. Elimina los comentarios del JSON
        3. Encuentra el JSON válido
        """
        # 1. Eliminar bloques de código markdown
        response = re.sub(r'```json\n|\n```', '', response)
        
        # 2. Eliminar comentarios del JSON
        response = re.sub(r'//.*$', '', response, flags=re.MULTILINE)
        
        # 3. Encontrar el primer JSON válido
        json_match = re.search(r'(\{.*\})', response, re.DOTALL)
        if not json_match:
            raise ValueError("No se encontró un JSON válido en la respuesta")
            
        json_str = json_match.group(1)
        
        # 4. Limpiar espacios extra y líneas vacías
        json_str = re.sub(r',(\s*[\]}])', r'\1', json_str)
        
        return json_str

    def _validate_response(self, response: str) -> bool:
        """
        Valida que la respuesta tenga el formato JSON esperado
        Args:
            response: Respuesta de OpenAI
        Returns:
            bool: True si la respuesta es válida
        """
        try:
            # Log de la respuesta completa para debug
            logger.debug("📝 Respuesta completa recibida:")
            logger.debug("-" * 40)
            logger.debug(response)
            logger.debug("-" * 40)

            # 1. Limpiar y obtener JSON válido
            try:
                json_str = self._clean_json_response(response)
                logger.debug("1️⃣ JSON limpio:")
                logger.debug(json_str)
            except ValueError as e:
                logger.error(f"❌ Error limpiando JSON: {str(e)}")
                return False
            
            # 2. Intentar parsear JSON
            try:
                data = json.loads(json_str)
                logger.debug("2️⃣ JSON parseado correctamente")
            except json.JSONDecodeError as e:
                logger.error(f"❌ Error parseando JSON: {str(e)}")
                logger.error("Respuesta problemática:")
                logger.error(json_str)
                return False
            
            # 3. Validar campos requeridos
            required_fields = [
                'term_in_english',
                'related_terms',
                'test_types',
                'loinc_codes',
                'keywords'
            ]
            
            missing_fields = []
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                logger.error(f"❌ Faltan campos requeridos: {missing_fields}")
                return False
                    
            logger.info("✅ Todos los campos requeridos están presentes")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error validando respuesta: {str(e)}")
            return False

    def process_term(
        self, 
        term: str,
        install_id: str,
        model: str = "gpt-4o",
        temperature: float = 0.75
    ) -> Optional[Dict[str, Any]]:
        """
        Procesa un término médico usando OpenAI para obtener información estructurada
        Args:
            term: Término médico a analizar
            install_id: ID de instalación del usuario
            model: Modelo de OpenAI a usar (default: gpt-4o)
            temperature: Temperatura para la respuesta (default: 0.75)
        Returns:
            Dict con la información estructurada o None si hay error
        """
        try:
            # Validar inicialización
            if not self.initialized:
                logger.error("❌ Servicio no inicializado")
                return None

            logger.info("=" * 50)
            logger.info("🔍 INICIO PROCESO DE TÉRMINO")
            logger.info(f"📝 Término recibido: '{term}'")
            logger.info(f"🔑 Install ID: {install_id}")
            logger.info(f"⚙️ Configuración: model={model}, temperature={temperature}")

            # Validar término
            if not term or not isinstance(term, str):
                logger.error("❌ Término inválido")
                logger.error(f"Tipo recibido: {type(term)}")
                logger.error(f"Valor recibido: {term}")
                return None

            # Construir el prompt
            user_prompt = f"""Analyze the following laboratory test or medical term and provide relevant information for LOINC search:
            Term: {term}"""
            logger.info("📋 User Prompt construido:")
            logger.info("-" * 40)
            logger.info(user_prompt)
            logger.info("-" * 40)

            # Procesar con OpenAI usando lazy loading
            logger.info("🔄 Obteniendo OpenAIService...")
            if not self.openai_service:
                logger.error("❌ No se pudo obtener OpenAIService")
                return None
            
            logger.info("✅ OpenAIService obtenido correctamente")

            # Procesar con OpenAI
            logger.info("🚀 Enviando solicitud a OpenAI...")
            response = self.openai_service.process_query(
                user_prompt=user_prompt,
                install_id=install_id,
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
            try:
                # Limpiar y obtener JSON válido
                json_str = self._clean_json_response(response)
                # Parsear a diccionario
                data = json.loads(json_str)
                
                # Añadir el término original
                enriched_data = {
                    "original_term": term,
                    **data
                }
                
                logger.debug("✅ Término procesado correctamente")
                return enriched_data
                
            except Exception as e:
                logger.error(f"❌ Error procesando término: {str(e)}")
                return None

        except Exception as e:
            logger.error("=" * 50)
            logger.error("❌ ERROR EN PROCESO DE TÉRMINO")
            logger.error(f"Tipo de error: {type(e).__name__}")
            logger.error(f"Mensaje: {str(e)}")
            logger.exception("Detalles del error:")
            logger.error("=" * 50)
            return None

    def register_handlers(self, socketio):
        """Registra los handlers de eventos para Ontología"""
        if not socketio:
            return
            
        logger.debug("🔍 Registrando handlers Ontología")
        
        @socketio.on('ontology.search')
        def handle_search(data):
            try:
                # Validar datos
                if not isinstance(data, dict):
                    logger.error("❌ Datos inválidos para búsqueda")
                    emit('ontology.search_result', {
                        'status': 'error',
                        'message': 'Datos inválidos'
                    })
                    return

                # Procesar búsqueda
                result = self.process_search(data)
                if not result:
                    logger.error("❌ Error procesando búsqueda")
                    emit('ontology.search_result', {
                        'status': 'error',
                        'message': 'Error procesando búsqueda'
                    })
                    return

                # Emitir resultado
                emit('ontology.search_result', {
                    'status': 'success',
                    'data': result
                })

            except Exception as e:
                logger.error(f"❌ Error en búsqueda: {str(e)}")
                emit('ontology.search_result', {
                    'status': 'error',
                    'message': str(e)
                })

# Crear instancia global
ontology_service = OntologyService() 