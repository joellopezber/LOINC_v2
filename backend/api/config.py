from flask import Blueprint, jsonify, request
import logging
from core.security.auth_middleware import require_api_token, require_admin
from core.security.token_manager import token_manager

logger = logging.getLogger(__name__)
config_bp = Blueprint('config', __name__)

@config_bp.route('/api/config/openai-key', methods=['POST'])
@require_api_token
@require_admin
def set_openai_key():
    """Endpoint para recibir y almacenar la API key de OpenAI de forma segura"""
    try:
        data = request.get_json()
        encrypted_key = data.get('encrypted_key')
        
        if not encrypted_key:
            logger.error("❌ No se proporcionó API key encriptada")
            return jsonify({
                'success': False,
                'error': 'API key no proporcionada'
            }), 400
            
        # Desencriptar la key
        try:
            api_key = token_manager.decrypt_key(encrypted_key)
            if not api_key.startswith('sk-'):
                raise ValueError("Formato de API key inválido")
        except Exception as e:
            logger.error(f"❌ Error desencriptando API key: {e}")
            return jsonify({
                'success': False,
                'error': 'API key inválida o corrupta'
            }), 400
            
        # Aquí almacenaríamos la key de forma segura
        # Por ahora la mantenemos en memoria
        token_manager.current_api_key = api_key
        
        return jsonify({
            'success': True,
            'message': 'API key almacenada correctamente'
        })
        
    except Exception as e:
        logger.error(f"❌ Error procesando API key: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@config_bp.route('/api/config/openai-key', methods=['GET'])
@require_api_token
def get_openai_key():
    """Endpoint para obtener la API key de OpenAI"""
    try:
        api_key = getattr(token_manager, 'current_api_key', None)
        if not api_key:
            logger.error("❌ No hay API key configurada")
            return jsonify({
                'success': False,
                'error': 'No hay API key configurada'
            }), 404
            
        # Encriptar la key antes de enviarla
        encrypted_key = token_manager.encrypt_key(api_key)
        
        return jsonify({
            'success': True,
            'api_key': encrypted_key
        })
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo API key: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500 