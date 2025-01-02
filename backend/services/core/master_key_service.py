import logging
import os
import hashlib
from typing import Optional
from ..lazy_load_service import LazyLoadService
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)

class MasterKeyService(LazyLoadService):
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MasterKeyService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio de master key"""
        if hasattr(self, '_initialized'):
            return
            
        super().__init__()
        try:
            # Obtener salt del .env
            salt_hex = os.getenv('SALT_MASTER_KEY')
            if not salt_hex:
                raise ValueError("SALT_MASTER_KEY no encontrada en .env")
            
            # Validar longitud
            if len(salt_hex) != 64:  # 32 bytes = 64 chars hex
                raise ValueError("SALT_MASTER_KEY debe ser 32 bytes (64 caracteres hex)")
                
            try:
                # Convertir de hex a bytes
                self.salt_master_key = bytes.fromhex(salt_hex)
            except ValueError as e:
                raise ValueError("SALT_MASTER_KEY debe ser un valor hexadecimal válido")
            
            self._set_initialized(True)
            logger.debug("🔐 MasterKey inicializado")
        except Exception as e:
            self._set_initialized(False, str(e))
            raise

    def get_salt_master_key(self) -> bytes:
        """Obtiene la salt master key"""
        return self.salt_master_key

    def get_key_for_install(self, install_timestamp: str) -> str:
        """
        Genera una clave determinista para una instalación específica.
        Args:
            install_timestamp: Timestamp de instalación como string
        Returns:
            Clave hexadecimal de 32 bytes (64 caracteres hex)
        """
        try:
            # Usar PBKDF2 para generar una clave determinista
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=self.salt_master_key,
                iterations=100000,
            )
            
            # Derivar clave usando el install_timestamp como input
            key = kdf.derive(install_timestamp.encode())
            
            # Convertir a hexadecimal
            return key.hex()
            
        except Exception as e:
            logger.error(f"❌ Error generando clave para install_timestamp {install_timestamp}: {e}")
            return None

# Instancia global
master_key_service = MasterKeyService() 