from .on_demand import OnDemandHandlers

class HandlersRegistry:
    @staticmethod
    def register_all(socketio):
        """Registra los handlers de websocket"""
        # Por ahora no registramos nada automáticamente
        pass
