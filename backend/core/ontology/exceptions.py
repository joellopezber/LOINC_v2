class DomainError(Exception):
    """Excepción base para errores del dominio"""
    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)

class AnalysisError(DomainError):
    """Excepción para errores en el análisis de términos"""
    def __init__(self, message: str, status_code: int = 500):
        self.status_code = status_code
        super().__init__(message)

class ValidationError(DomainError):
    """Excepción para errores de validación"""
    def __init__(self, message: str):
        super().__init__(message)

class ServiceError(DomainError):
    """Excepción para errores de servicio"""
    def __init__(self, message: str, original_error: Exception = None):
        self.original_error = original_error
        super().__init__(message) 