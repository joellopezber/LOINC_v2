import logging
from .base_handlers import OnDemandHandlers

logger = logging.getLogger(__name__)

class OntologyHandlers(OnDemandHandlers):
    """Handler para procesar mensajes de ontología"""
    
    def __init__(self, socketio):
        logger.info("=" * 50)
        logger.info("🔄 Inicializando OntologyHandlers")
        super().__init__(socketio, 'ontology')
        if not self.service:
            logger.error("❌ No se pudo obtener el servicio de ontología")
            return
        logger.info("✅ OntologyHandlers inicializado")
        logger.info("=" * 50)
    
    def _register_handlers(self):
        """Registra los handlers de eventos"""
        logger.info("🔄 Registrando handlers de Ontología")
        
        @self.socketio.on('ontology.search')
        def handle_search(data):
            logger.info("=" * 50)
            logger.info("📨 Recibido ontology.search")
            logger.info(f"📝 Término: {data.get('text', 'N/A')}")
            logger.info(f"🔑 Install ID: {data.get('install_id', 'N/A')}")
            
            try:
                # Validar datos y obtener request_id
                is_valid, error, request_id = self._validate_data(
                    data, ['text'], 'ontology.result'
                )
                if not is_valid:
                    logger.error(f"❌ Datos inválidos: {error}")
                    self._emit_error('ontology.result', error, request_id)
                    return

                if not self.service:
                    logger.error("❌ Servicio de ontología no disponible")
                    self._emit_error('ontology.result', "Servicio no disponible", request_id)
                    return

                # Procesar con Ontología
                logger.info("🔄 Procesando término con Ontología")
                response = self.service.process_query(
                    user_prompt=data.get('text'),
                    install_id=data.get('install_id', 'default')
                )

                if not response:
                    logger.error("❌ No se obtuvo respuesta de Ontología")
                    self._emit_error('ontology.result', "No se obtuvo respuesta de Ontología", request_id)
                    return

                # Enviar respuesta
                logger.info("✅ Respuesta obtenida, enviando al cliente")
                self.socketio.emit('ontology.result', {
                    'status': 'success',
                    'query': data.get('text', ''),
                    'response': response,
                    'request_id': request_id
                })
                logger.info("=" * 50)
                
            except Exception as e:
                logger.error(f"❌ Error procesando término: {str(e)}")
                self._emit_error('ontology.result', str(e), data.get('request_id')) 