import logging
from ...on_demand.openai_service import openai_service

logger = logging.getLogger(__name__)

class OpenAIHandlers:
    @staticmethod
    def register(socketio):
        @socketio.on('openai.test_search')
        def handle_test_search(data):
            """Maneja la solicitud de prueba de búsqueda con OpenAI"""
            try:
                logger.info("\n🔍 Iniciando prueba OpenAI...")
                
                # Validar datos
                if not isinstance(data, dict):
                    raise ValueError("Datos recibidos no son un diccionario válido")

                # Procesar la consulta
                response = openai_service.process_query(
                    text=data.get('text'),
                    messages=data.get('messages', []),
                    system_prompt=data.get('systemPrompt', '')
                )

                # Enviar respuesta
                socketio.emit('openai.test_result', {
                    'status': 'success',
                    'query': data.get('text', ''),
                    'response': response
                })

            except Exception as e:
                error_msg = f"❌ Error en OpenAI handler: {str(e)}"
                logger.error(error_msg)
                socketio.emit('openai.test_result', {
                    'status': 'error',
                    'message': error_msg
                }) 