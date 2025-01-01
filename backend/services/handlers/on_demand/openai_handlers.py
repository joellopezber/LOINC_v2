import logging
from ...on_demand.openai_service import openai_service

logger = logging.getLogger(__name__)

class OpenAIHandlers:
    """Handler para procesar mensajes con OpenAI"""
    
    def __init__(self, socketio):
        self.socketio = socketio
        self._register_handlers()
    
    def _register_handlers(self):
        """Registra los handlers de eventos"""
        @self.socketio.on('openai.test_search')
        def handle_chat_message(data):
            logger.info("🔄 Procesando mensaje OpenAI")
            
            try:
                # Validar datos
                if not isinstance(data, dict):
                    raise ValueError("Datos recibidos no son un diccionario válido")

                # Validar install_id
                install_id = data.get('install_id')
                if not install_id:
                    raise ValueError("Se requiere install_id")

                # Procesar con OpenAI
                response = openai_service.process_query(
                    user_prompt=data.get('text'),
                    install_id=install_id,
                    chat_history=data.get('messages', [])[:-1],
                    model=data.get('model', 'gpt-4o'),
                    temperature=data.get('temperature', 0.7),
                    system_prompt=data.get('systemPrompt')
                )

                if not response:
                    raise ValueError("No se obtuvo respuesta de OpenAI")

                logger.info("✅ Respuesta obtenida")

                # Enviar respuesta
                self.socketio.emit('openai.test_result', {
                    'status': 'success',
                    'query': data.get('text', ''),
                    'response': response
                })
                
            except Exception as e:
                error_msg = f"❌ Error: {str(e)}"
                logger.error(error_msg)
                self.socketio.emit('openai.test_result', {
                    'status': 'error',
                    'message': error_msg
                }) 