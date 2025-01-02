import logging
from .base_handlers import OnDemandHandlers

logger = logging.getLogger(__name__)

class DatabaseSearchHandlers(OnDemandHandlers):
    """Handler para procesar búsquedas en base de datos"""
    
    def __init__(self, socketio):
        super().__init__(socketio, 'database_search')
    
    def _register_handlers(self):
        """Registra los handlers de eventos"""
        logger.info("🔄 Registrando handlers de Database Search")
        
        @self.socketio.on('database.search')
        def handle_search(data):
            logger.info("📨 Mensaje recibido en database.search")
            logger.debug(f"📦 Datos recibidos: {data}")
            
            try:
                # Validar datos y obtener request_id
                is_valid, error, request_id = self._validate_data(
                    data, ['install_id', 'query'], 'database.result'
                )
                if not is_valid:
                    self._emit_error('database.result', error, request_id)
                    return

                # Procesar búsqueda
                logger.info(f"🔄 Procesando búsqueda con install_id: {data['install_id']}")
                results = self.service.search(
                    query=data.get('query'),
                    install_id=data['install_id'],
                    limit=data.get('limit', 10)
                )

                if results is None:
                    self._emit_error('database.result', "No se obtuvieron resultados", request_id)
                    return

                logger.info("✅ Resultados obtenidos")
                logger.debug(f"📤 Enviando {len(results)} resultados")

                # Enviar respuesta
                self.socketio.emit('database.result', {
                    'status': 'success',
                    'query': data.get('query', ''),
                    'results': results,
                    'request_id': request_id
                })
                
            except Exception as e:
                self._emit_error('database.result', str(e), data.get('request_id')) 