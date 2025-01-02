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
        try:
            self._master_key = None
            self.install_keys = {}  # Inicializar el diccionario de claves por instalación
            self._set_initialized(True)
            logger.debug("🔐 Encryption inicializado")
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
                logger.error("❌ MasterKey no disponible")
                return None
                
            self.install_keys[install_timestamp] = self.master_key_service.get_key_for_install(install_timestamp)
        
        return self.install_keys.get(install_timestamp)

    def _derive_key(self, salt, master_key):
        """
        Deriva una clave usando PBKDF2
        """
        # Convertir master_key de hex a bytes
        key_bytes = bytes.fromhex(master_key)
        
        # Usar PBKDF2 para derivar la clave
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        
        return kdf.derive(key_bytes)

    def encrypt(self, data: str, install_id: str) -> Optional[str]:
        """Encripta datos usando la master key"""
        try:
            if not data or not install_id:
                return None

            # Obtener la master key
            master_key = self.get_key_for_install(install_id)
            if not master_key:
                return None

            # Generar salt aleatorio
            salt = os.urandom(16)

            # Derivar clave usando PBKDF2
            key = self._derive_key(salt, master_key)

            # Crear cipher
            cipher = AESGCM(key)

            # Generar IV aleatorio
            iv = os.urandom(12)

            # Encriptar datos
            encrypted = cipher.encrypt(iv, data.encode(), None)

            # Combinar salt + iv + encrypted en un solo buffer
            result = salt + iv + encrypted

            # Convertir a base64
            return base64.b64encode(result).decode()

        except Exception as e:
            logger.error(f"❌ Error encriptando: {e}")
            return None

    def decrypt(self, encrypted_b64: str, install_id: str) -> Optional[str]:
        """Desencripta datos usando la master key"""
        try:
            if not encrypted_b64 or not install_id:
                return None

            # Obtener la master key
            master_key = self.get_key_for_install(install_id)
            if not master_key:
                return None

            # Decodificar base64
            encrypted_data = base64.b64decode(encrypted_b64)

            # Extraer salt, iv y contenido
            salt = encrypted_data[:16]
            iv = encrypted_data[16:28]
            content = encrypted_data[28:]

            # Derivar clave usando PBKDF2
            key = self._derive_key(salt, master_key)

            # Crear cipher
            cipher = AESGCM(key)

            # Desencriptar
            decrypted = cipher.decrypt(iv, content, None)

            return decrypted.decode()

        except Exception as e:
            logger.error(f"❌ Error desencriptando: {e}")
            return None

# Crear instancia global
encryption_service = EncryptionService() 