import logging
from typing import Dict, Any
from ..services.ontology_service import ontology_service

logger = logging.getLogger(__name__)

class OntologyHandlers:
    """Handler para procesar mensajes de ontología"""
    
    @staticmethod
    def register(socketio):
        """Registra los handlers de eventos"""
        
        @socketio.on('ontology.search')
        def handle_ontology_search(data):
            logger.info("🔍 Procesando solicitud de búsqueda ontológica")
            logger.debug(f"📥 Datos recibidos: {data}")
            
            try:
                # Validar datos
                if not isinstance(data, dict):
                    logger.error("❌ Datos recibidos no son un diccionario")
                    raise ValueError("Datos recibidos no son un diccionario válido")

                # Validar install_id
                install_id = data.get('install_id')
                logger.debug(f"🔑 Install ID recibido: {install_id}")
                if not install_id:
                    logger.error("❌ Falta install_id")
                    raise ValueError("Se requiere install_id")

                # Validar texto
                text = data.get('text')
                logger.debug(f"📝 Texto recibido: {text}")
                if not text:
                    logger.error("❌ Falta texto")
                    raise ValueError("Se requiere texto para búsqueda")

                # Obtener request_id
                request_id = data.get('request_id')
                logger.debug(f"🔍 Request ID recibido: {request_id}")
                if not request_id:
                    logger.error("❌ Falta request_id")
                    raise ValueError("Se requiere request_id")

                # Procesar término
                logger.info(f"🔄 Procesando término: {text}")
                result = ontology_service.process_term(
                    term=text,
                    install_id=install_id
                )
                logger.debug(f"✅ Resultado obtenido: {result}")

                if not result:
                    logger.error("❌ No se obtuvo resultado")
                    raise ValueError("No se obtuvo respuesta del servicio")

                # Enviar respuesta
                logger.info(f"📤 Enviando respuesta para request_id: {request_id}")
                response_data = {
                    'status': 'success',
                    'query': text,
                    'response': result,
                    'request_id': request_id
                }
                logger.debug(f"📦 Datos de respuesta: {response_data}")
                socketio.emit('ontology.search_result', response_data)
                logger.info("✅ Respuesta enviada correctamente")

            except Exception as e:
                logger.error(f"❌ Error procesando término: {str(e)}")
                error_response = {
                    'status': 'error',
                    'message': 'Error procesando término',
                    'request_id': data.get('request_id')
                }
                logger.debug(f"📦 Datos de error: {error_response}")
                socketio.emit('ontology.search_result', error_response)
                logger.info("✅ Respuesta de error enviada")

        @socketio.on('ontology.test')
        def on_ontology_test(data):
            """Handler para test de ontología"""
            try:
                # Validar datos
                if not isinstance(data, dict):
                    raise ValueError("Datos recibidos no son un diccionario válido")

                # Validar install_id
                install_id = data.get('install_id')
                if not install_id:
                    raise ValueError("Se requiere install_id")

                # Procesar test
                result = ontology_service.process_test(data, install_id)
                
                socketio.emit('ontology.test_result', {
                    'status': 'success',
                    'response': result
                })
                
            except Exception as e:
                logger.error(f"❌ Error en test ontología: {e}")
                socketio.emit('ontology.test_result', {
                    'status': 'error',
                    'message': str(e)
                })
                
        logger.info("✅ Handlers de ontología registrados") 