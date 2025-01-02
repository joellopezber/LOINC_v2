import logging
from .base_handlers import OnDemandHandlers

logger = logging.getLogger(__name__)

class OpenAIHandlers(OnDemandHandlers):
    """Handler para procesar mensajes con OpenAI"""
    
    def __init__(self, socketio):
        logger.info("=" * 50)
        logger.info("🔄 Inicializando OpenAIHandlers")
        super().__init__(socketio, 'openai')
        if not self.service:
            logger.error("❌ No se pudo obtener el servicio de OpenAI")
            return
        logger.info("✅ OpenAIHandlers inicializado")
        logger.info("=" * 50)
    
    def _register_handlers(self):
        """Registra los handlers de eventos"""
        logger.info("🔄 Registrando handlers de OpenAI")
        
        @self.socketio.on('openai.test_search')
        def handle_chat_message(data):
            logger.info("=" * 50)
            logger.info("📨 Recibido openai.test_search")
            logger.info(f"📝 Mensaje: {data.get('text', 'N/A')}")
            logger.info(f"🔑 Install ID: {data.get('install_id', 'N/A')}")
            
            try:
                # Validar datos y obtener request_id
                is_valid, error, request_id = self._validate_data(
                    data, ['text'], 'openai.test_result'
                )
                if not is_valid:
                    logger.error(f"❌ Datos inválidos: {error}")
                    self._emit_error('openai.test_result', error, request_id)
                    return

                if not self.service:
                    logger.error("❌ Servicio de OpenAI no disponible")
                    self._emit_error('openai.test_result', "Servicio no disponible", request_id)
                    return

                # Procesar con OpenAI
                model = data.get('model', 'gpt-4o')
                temperature = data.get('temperature', 0.7)
                logger.info("🔄 Enviando consulta a OpenAI")
                response = self.service.process_query(
                    user_prompt=data.get('text'),
                    install_id=data.get('install_id', 'default'),
                    chat_history=data.get('messages', [])[:-1],
                    model=model,
                    temperature=temperature,
                    system_prompt=data.get('systemPrompt')
                )

                if not response:
                    logger.error("❌ No se obtuvo respuesta de OpenAI")
                    self._emit_error('openai.test_result', "No se obtuvo respuesta de OpenAI", request_id)
                    return

                # Enviar respuesta
                logger.info("✅ Respuesta obtenida, enviando al cliente")
                self.socketio.emit('openai.test_result', {
                    'status': 'success',
                    'query': data.get('text', ''),
                    'response': response,
                    'request_id': request_id
                })
                logger.info("=" * 50)
                
            except Exception as e:
                logger.error(f"❌ Error procesando mensaje: {str(e)}")
                self._emit_error('openai.test_result', str(e), data.get('request_id')) 