from functools import wraps
from flask import request, jsonify
from .token_manager import token_manager
import logging

logger = logging.getLogger(__name__)

def require_api_token(f):
    """Decorator que verifica el token JWT en el header Authorization"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            logger.error("❌ No se proporcionó header de autorización")
            return jsonify({'error': 'No autorizado'}), 401
            
        try:
            # Extraer el token del header (formato: "Bearer <token>")
            if not auth_header.startswith('Bearer '):
                logger.error("❌ Formato de token inválido")
                return jsonify({'error': 'Formato de token inválido'}), 401
                
            token = auth_header.split(' ')[1]
            
            # Validar el token
            payload = token_manager.validate_token(token)
            if not payload:
                logger.error("❌ Token inválido o expirado")
                return jsonify({'error': 'Token inválido o expirado'}), 401
            
            # Agregar payload al contexto de la request
            request.token_payload = payload
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"❌ Error validando token: {e}")
            return jsonify({'error': 'Error de autenticación'}), 401
            
    return decorated

def require_admin(f):
    """Decorator que verifica si el usuario es admin"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(request, 'token_payload'):
            logger.error("❌ No hay token payload en el request")
            return jsonify({'error': 'No autorizado'}), 401
            
        if not request.token_payload.get('is_admin'):
            logger.error("❌ Usuario no es admin")
            return jsonify({'error': 'Se requieren privilegios de administrador'}), 403
            
        return f(*args, **kwargs)
        
    return decorated 