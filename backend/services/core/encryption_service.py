from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
import os
import logging
import base64
import traceback
from typing import Optional
from ..lazy_load_service import LazyLoadService, lazy_load

# Configurar logging
logger = logging.getLogger(__name__)

class EncryptionService(LazyLoadService):
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EncryptionService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio de encriptación"""
        if hasattr(self, '_initialized'):
            return
            
        super().__init__()
        logger.info("🔐 Inicializando Encryption service...")
        
        try:
            self.install_keys = {}  # Diccionario para almacenar claves por installTimestamp
            self._master_key_service = None
            self._set_initialized(True)
            
        except Exception as e:
            self._set_initialized(False, str(e))
            raise

    @property
    @lazy_load('master_key')
    def master_key_service(self):
        """Obtiene el MasterKeyService de forma lazy"""
        return self._master_key_service

    def get_key_for_install(self, install_timestamp):
        """
        Obtiene la master key para una instalación específica.
        La clave se genera de forma determinista basada en el installTimestamp.
        """
        if install_timestamp not in self.install_keys:
            # Obtener la clave del master_key_service
            if not self.master_key_service:
                logger.error("❌ MasterKeyService no disponible")
                return None
                
            self.install_keys[install_timestamp] = self.master_key_service.get_key_for_install(install_timestamp)
        
        return self.install_keys[install_timestamp]

    def _derive_key(self, salt, master_key):
        """
        Deriva una clave usando HKDF, igual que en el frontend
        """
        # Convertir master_key de hex a bytes
        key_bytes = bytes.fromhex(master_key)
        
        # Usar HKDF para derivar la clave
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            info=b'',
        )
        
        return hkdf.derive(key_bytes)

    def encrypt(self, data, install_timestamp):
        """
        Encripta datos usando AES-GCM, igual que el frontend
        """
        try:
            if not data:
                return None
                
            # Obtener master key
            master_key = self.get_key_for_install(install_timestamp)
            if not master_key:
                logger.error("❌ No se pudo obtener master key")
                return None
            
            # Generar salt y IV aleatorios
            salt = os.urandom(16)
            iv = os.urandom(12)
            
            # Derivar clave específica
            key = self._derive_key(salt, master_key)
            
            # Encriptar usando AES-GCM
            aesgcm = AESGCM(key)
            encrypted_data = aesgcm.encrypt(iv, data.encode(), None)
            
            # Combinar salt + iv + datos encriptados
            result = salt + iv + encrypted_data
            
            # Convertir a base64
            return base64.b64encode(result).decode()
            
        except Exception as e:
            logger.error(f"Error en encriptación: {e}")
            logger.error(traceback.format_exc())
            return None

    def decrypt(self, encrypted_data: str, install_timestamp: str) -> Optional[str]:
        """
        Desencripta datos usando AES-GCM
        
        Args:
            encrypted_data: Datos encriptados en base64
            install_timestamp: Timestamp de instalación
            
        Returns:
            Datos desencriptados o None si hay error
        """
        try:
            if not encrypted_data:
                return None

            # 1. Obtener master key
            master_key = self.get_key_for_install(install_timestamp)
            if not master_key:
                logger.error("❌ No se pudo obtener la master key")
                return None
            
            # 2. Decodificar datos encriptados
            decoded_data = base64.b64decode(encrypted_data)
            
            # 3. Extraer salt, iv y contenido
            salt = decoded_data[:16]
            iv = decoded_data[16:28]
            content = decoded_data[28:]
            
            # 4. Derivar clave específica usando HKDF
            key = self._derive_key(salt, master_key)
            
            # 5. Desencriptar usando AES-GCM
            aesgcm = AESGCM(key)
            decrypted_data = aesgcm.decrypt(iv, content, None)
            
            # 6. Decodificar a string
            result = decrypted_data.decode()
            logger.info("✅ Datos desencriptados correctamente")
            return result

        except Exception as e:
            logger.error(f"❌ Error desencriptando datos: {e}")
            logger.error(traceback.format_exc())
            return None

# Crear instancia global
encryption_service = EncryptionService() 