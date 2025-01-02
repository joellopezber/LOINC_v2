from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import os
import logging
from typing import Optional
from ..lazy_load_service import LazyLoadService, lazy_load

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
        Deriva una clave AES-GCM usando HKDF, siguiendo el mismo proceso que el frontend:
        1. Importar master key como bytes
        2. Usar HKDF para derivar una clave específica AES-GCM
        """
        try:
            from cryptography.hazmat.primitives.kdf.hkdf import HKDF
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.backends import default_backend
            
            # 1. Convertir master_key de hex a bytes
            key_material = bytes.fromhex(master_key)
            
            # 2. Configurar HKDF con los mismos parámetros que el frontend
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,  # 256 bits para AES-256-GCM
                salt=salt,
                info=b'',  # info vacío como en el frontend
                backend=default_backend()
            )
            
            # 3. Derivar clave específica para AES-GCM
            key = hkdf.derive(key_material)
            
            # 4. Validar que la clave tenga el tamaño correcto para AES-256-GCM
            if len(key) != 32:  # 256 bits = 32 bytes
                logger.error("❌ Tamaño de clave incorrecto")
                return None
            
            logger.info("✅ Clave derivada correctamente")
            return key

        except Exception as e:
            logger.error(f"❌ Error derivando clave: {e}")
            return None

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
            if not key:
                return None

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

            try:
                # Decodificar base64
                encrypted_data = base64.b64decode(encrypted_b64)
            except Exception as e:
                logger.error(f"❌ Error decodificando base64: {str(e)}")
                return None

            try:
                # Extraer salt, iv y contenido
                salt = encrypted_data[:16]
                iv = encrypted_data[16:28]
                content = encrypted_data[28:]
            except Exception as e:
                logger.error(f"❌ Error extrayendo componentes: {str(e)}")
                return None

            # Derivar clave usando PBKDF2
            key = self._derive_key(salt, master_key)
            if not key:
                return None

            try:
                # Crear cipher
                cipher = AESGCM(key)

                # Desencriptar
                decrypted = cipher.decrypt(iv, content, None)
            except Exception as e:
                logger.error(f"❌ Error en desencriptación AES-GCM: {str(e)}")
                return None

            try:
                result = decrypted.decode()
                logger.info("✅ Desencriptación completada")
                return result
            except Exception as e:
                logger.error(f"❌ Error decodificando resultado: {str(e)}")
                return None

        except Exception as e:
            logger.error(f"❌ Error desencriptando: {str(e)}")
            return None

# Instancia global
encryption_service = EncryptionService() 