import jwt
import datetime
from typing import Dict, Optional
import logging
from cryptography.fernet import Fernet
import os
import base64

logger = logging.getLogger(__name__)

class TokenManager:
    _instance = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def __init__(self):
        self.logger = logging.getLogger('backend.core.security.token_manager')
        # Generar o cargar clave secreta para JWT
        self.jwt_secret = os.getenv('JWT_SECRET_KEY') or self._generate_secret()
        # Generar o cargar clave para encriptación Fernet
        self.encryption_key = os.getenv('ENCRYPTION_KEY') or self._generate_encryption_key()
        self.cipher_suite = Fernet(self.encryption_key)
        
    def _generate_secret(self) -> str:
        """Genera una clave secreta para JWT"""
        return base64.b64encode(os.urandom(32)).decode('utf-8')
        
    def _generate_encryption_key(self) -> bytes:
        """Genera una clave para encriptación Fernet"""
        return base64.b64encode(os.urandom(32))
    
    def create_token(self, data: Dict) -> str:
        """Crea un token JWT con los datos proporcionados"""
        try:
            payload = {
                **data,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
            }
            return jwt.encode(payload, self.jwt_secret, algorithm='HS256')
        except Exception as e:
            self.logger.error(f"❌ Error creando token: {e}")
            raise
    
    def validate_token(self, token: str) -> Optional[Dict]:
        """Valida un token JWT y retorna sus datos"""
        try:
            return jwt.decode(token, self.jwt_secret, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            self.logger.error("❌ Token expirado")
            return None
        except jwt.InvalidTokenError as e:
            self.logger.error(f"❌ Token inválido: {e}")
            return None
            
    def encrypt_key(self, api_key: str) -> str:
        """Encripta una API key"""
        try:
            return self.cipher_suite.encrypt(api_key.encode()).decode()
        except Exception as e:
            self.logger.error(f"❌ Error encriptando API key: {e}")
            raise
            
    def decrypt_key(self, encrypted_key: str) -> str:
        """Desencripta una API key"""
        try:
            return self.cipher_suite.decrypt(encrypted_key.encode()).decode()
        except Exception as e:
            self.logger.error(f"❌ Error desencriptando API key: {e}")
            raise

# Instancia global
token_manager = TokenManager() 