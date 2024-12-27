import logging
import os
import hashlib
from typing import Optional

logger = logging.getLogger(__name__)

class MasterKeyService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MasterKeyService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio de master key"""
        if hasattr(self, 'initialized'):
            return
            
        logger.info("🔐 Inicializando MasterKey service...")
        self.salt_master_key = os.environ.get('SALT_MASTER_KEY')
        
        if not self.salt_master_key:
            logger.error("❌ SALT_MASTER_KEY no encontrada en variables de entorno")
        else:
            logger.info("✅ SALT_MASTER_KEY cargada correctamente")
            
        self.initialized = True

    def get_key_for_install(self, install_timestamp: str) -> Optional[str]:
        """
        Genera una master key única para una instalación
        
        Args:
            install_timestamp: Timestamp de instalación
            
        Returns:
            Master key en formato hexadecimal o None si hay error
        """
        try:
            if not self.salt_master_key:
                logger.error("❌ No se puede generar master key - SALT no disponible")
                return None
                
            if not install_timestamp:
                logger.error("❌ No se puede generar master key - timestamp no válido")
                return None

            # Convertir timestamp a bytes
            timestamp_bytes = str(install_timestamp).encode()
            
            # Usar PBKDF2 para derivar una clave segura
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
            
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,  # 32 bytes = 256 bits
                salt=bytes.fromhex(self.salt_master_key),
                iterations=100000,
            )
            
            # Derivar la clave y convertirla a hexadecimal
            key_bytes = kdf.derive(timestamp_bytes)
            master_key = key_bytes.hex()
            
            logger.info("✅ Master key generada correctamente")
            return master_key

        except Exception as e:
            logger.error(f"❌ Error generando master key: {e}")
            return None

# Instancia global
master_key_service = MasterKeyService() 