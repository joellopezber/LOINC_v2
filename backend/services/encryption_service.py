from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import logging
import base64
import traceback

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class EncryptionService:
    def __init__(self):
        """Inicializa el servicio de encriptación"""
        logger.info("Inicializando encryption service...")
        self.install_keys = {}  # Diccionario para almacenar claves por installTimestamp
    
    def generate_new_key(self):
        """Genera una nueva master key"""
        try:
            logger.info("Generando nueva master key...")
            new_key = Fernet.generate_key().hex()
            logger.debug(f"Nueva master key generada (primeros 10 chars): {new_key[:10]}...")
            return new_key
        except Exception as e:
            logger.error(f"Error generando nueva master key: {e}")
            logger.error(traceback.format_exc())
            raise

    def get_key_for_install(self, install_timestamp):
        """Obtiene o genera una clave para una instalación específica"""
        if install_timestamp not in self.install_keys:
            self.install_keys[install_timestamp] = self.generate_new_key()
        return self.install_keys[install_timestamp]

    def _derive_key(self, salt, master_key):
        """Deriva una clave usando HKDF"""
        try:
            logger.debug(f"Derivando clave con salt de longitud {len(salt)}")
            key_bytes = bytes.fromhex(master_key)
            logger.debug(f"Master key convertida a bytes (longitud: {len(key_bytes)})")
            
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                info=b'',
            )
            derived_key = hkdf.derive(key_bytes)
            logger.debug(f"Clave derivada exitosamente (longitud: {len(derived_key)})")
            return derived_key
            
        except Exception as e:
            logger.error(f"Error derivando clave: {e}")
            logger.error(traceback.format_exc())
            raise

    def decrypt_with_master_key(self, encrypted_data, install_timestamp):
        """Desencripta datos usando la master key de una instalación específica"""
        try:
            master_key = self.get_key_for_install(install_timestamp)
            
            # Decodificar datos de base64
            logger.debug("Decodificando datos de base64...")
            logger.debug(f"Datos encriptados (primeros 50 chars): {encrypted_data[:50]}...")
            data = base64.b64decode(encrypted_data)
            logger.debug(f"Datos decodificados (longitud: {len(data)} bytes)")
            
            # Extraer componentes
            salt = data[:16]
            iv = data[16:28]
            ciphertext = data[28:]
            logger.debug(f"Componentes extraídos - salt: {len(salt)} bytes, iv: {len(iv)} bytes, ciphertext: {len(ciphertext)} bytes")
            
            # Derivar clave
            logger.debug("Derivando clave...")
            key = self._derive_key(salt, master_key)
            logger.debug(f"Clave derivada (longitud: {len(key)} bytes)")
            
            # Desencriptar usando AES-GCM
            logger.debug("Desencriptando datos...")
            aesgcm = AESGCM(key)
            plaintext = aesgcm.decrypt(iv, ciphertext, None)
            
            result = plaintext.decode()
            logger.info(f"Datos desencriptados correctamente (longitud: {len(result)})")
            return result
            
        except Exception as e:
            logger.error(f"Error desencriptando con master key: {e}")
            logger.error(traceback.format_exc())
            return None

# Crear instancia global
encryption_service = EncryptionService() 