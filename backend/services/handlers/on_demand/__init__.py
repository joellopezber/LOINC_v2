# Este archivo puede estar vacío por ahora
# Los handlers se importarán directamente cuando se necesiten

class OnDemandHandlers:
    """Clase base para handlers on-demand"""
    
    @staticmethod
    def register_openai(socketio):
        """Registra solo el handler de OpenAI"""
        from .openai_handlers import OpenAIHandlers
        OpenAIHandlers.register(socketio)
        
    @staticmethod
    def register_ontology(socketio):
        """Registra solo el handler de Ontology"""
        from .ontology_handlers import OntologyHandlers
        OntologyHandlers.register(socketio)
        
    @staticmethod
    def register_database(socketio):
        """Registra solo el handler de Database"""
        from .database_handlers import DatabaseHandlers
        DatabaseHandlers.register(socketio)
        
    @staticmethod
    def register_all(socketio):
        """Registra todos los handlers (usar con precaución)"""
        OnDemandHandlers.register_openai(socketio)
        OnDemandHandlers.register_ontology(socketio)
        OnDemandHandlers.register_database(socketio)
