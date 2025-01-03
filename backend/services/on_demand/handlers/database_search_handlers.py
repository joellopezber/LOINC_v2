import logging
from .base_handlers import OnDemandHandlers

logger = logging.getLogger(__name__)

class DatabaseSearchHandlers(OnDemandHandlers):
    """Handler para procesar búsquedas en base de datos"""
    
    def __init__(self, socketio):
        logger.info("🔄 Inicializando DatabaseSearchHandlers")
        super().__init__(socketio, 'database_search')
        if not self.service:
            logger.error("❌ No se pudo obtener el servicio de Database Search")
            return
            
        # Configurar listener del servicio
        self.service.addListener(self._handle_service_response)
        logger.info("✅ DatabaseSearchHandlers inicializado")
    
    def _register_handlers(self):
        """Registra los handlers de eventos"""
        logger.info("🔄 Registrando handlers de Database Search")
        
        @self.socketio.on('database.search')
        def handle_search(data):
            logger.info("📨 Recibido database.search")
            logger.info(f"📝 Query: {data.get('query', 'N/A')}")
            logger.info(f"🔑 Install ID: {data.get('install_id', 'N/A')}")
            
            try:
                # Validar datos y obtener request_id
                is_valid, error, request_id = self._validate_data(
                    data, ['query', 'install_id'], 'database.result'
                )
                if not is_valid:
                    logger.error(f"❌ Datos inválidos: {error}")
                    self._emit_error('database.result', error, request_id)
                    return

                if not self.service:
                    logger.error("❌ Servicio de Database Search no disponible")
                    self._emit_error('database.result', "Servicio no disponible", request_id)
                    return

                # Procesar búsqueda
                logger.info("🔄 Procesando búsqueda")
                results = self.service.search_loinc(
                    query=data.get('query'),
                    user_id=data.get('install_id'),
                    limit=data.get('limit', 10)
                )

                if results is None:
                    logger.error("❌ No se obtuvieron resultados")
                    self._emit_error('database.result', "No se obtuvieron resultados", request_id)
                    return

                # La respuesta se maneja a través del listener del servicio
                
            except Exception as e:
                logger.error(f"❌ Error procesando búsqueda: {str(e)}")
                self._emit_error('database.result', str(e), data.get('request_id'))

        @self.socketio.on('database.status')
        def handle_status(data):
            logger.info("📨 Recibido database.status")
            logger.info(f"🔑 Install ID: {data.get('install_id', 'N/A')}")
            
            try:
                # Validar datos y obtener request_id
                is_valid, error, request_id = self._validate_data(
                    data, ['install_id'], 'database.status_result'
                )
                if not is_valid:
                    logger.error(f"❌ Datos inválidos: {error}")
                    self._emit_error('database.status_result', error, request_id)
                    return

                if not self.service:
                    logger.error("❌ Servicio de Database Search no disponible")
                    self._emit_error('database.status_result', "Servicio no disponible", request_id)
                    return

                # Obtener estado
                logger.info("🔄 Obteniendo estado del servicio")
                status = self.service.get_service_status(data.get('install_id'))

                # Enviar respuesta
                logger.info("✅ Estado obtenido")
                self.socketio.emit('database.status_result', {
                    'status': 'success',
                    'service_status': status,
                    'request_id': request_id
                })
                
            except Exception as e:
                logger.error(f"❌ Error obteniendo estado: {str(e)}")
                self._emit_error('database.status_result', str(e), data.get('request_id'))

        @self.socketio.on('database.test')
        def handle_test(data):
            logger.info("📨 Recibido database.test")
            logger.info(f"🧪 Test case: {data.get('test_id', 'N/A')}")
            
            try:
                # Validar datos y obtener request_id
                is_valid, error, request_id = self._validate_data(
                    data, ['test_id'], 'database.test_result'
                )
                if not is_valid:
                    logger.error(f"❌ Datos inválidos: {error}")
                    self._emit_error('database.test_result', error, request_id)
                    return

                if not self.service:
                    logger.error("❌ Servicio de Database Search no disponible")
                    self._emit_error('database.test_result', "Servicio no disponible", request_id)
                    return

                # Ejecutar test
                logger.info("🔄 Ejecutando test")
                test_result = self.service.run_test(data)

                # Enviar respuesta
                logger.info("✅ Test completado")
                self.socketio.emit('database.test_result', {
                    'status': 'success',
                    'test_id': data.get('test_id'),
                    'response': test_result,
                    'request_id': request_id
                })
                
            except Exception as e:
                logger.error(f"❌ Error ejecutando test: {str(e)}")
                self._emit_error('database.test_result', str(e), data.get('request_id'))

    def _handle_service_response(self, response):
        """Maneja las respuestas del servicio"""
        try:
            logger.debug("📩 Respuesta del servicio recibida")
            
            # Determinar el evento de respuesta según el tipo
            if 'test_id' in response:
                event = 'database.test_result'
            else:
                event = 'database.result'
            
            # Emitir respuesta
            self.socketio.emit(event, response)
            
        except Exception as e:
            logger.error(f"❌ Error manejando respuesta del servicio: {str(e)}")
            self._emit_error(event, str(e), response.get('request_id')) 