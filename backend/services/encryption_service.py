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
        self.master_key = None
        self.key_file = 'master.key'
        self.initialize()
    
    def initialize(self):
        """Inicializa o carga la master key"""
        try:
            if os.path.exists(self.key_file):
                logger.info("Cargando master key existente...")
                with open(self.key_file, 'rb') as f:
                    self.master_key = f.read().hex()
                logger.info("Master key cargada correctamente")
                logger.debug(f"Master key (primeros 10 chars): {self.master_key[:10]}...")
            else:
                logger.info("Generando nueva master key...")
                self.master_key = Fernet.generate_key().hex()
                with open(self.key_file, 'wb') as f:
                    f.write(bytes.fromhex(self.master_key))
                logger.info("Nueva master key generada y guardada")
                logger.debug(f"Nueva master key (primeros 10 chars): {self.master_key[:10]}...")
        except Exception as e:
            logger.error(f"Error inicializando encryption service: {e}")
            logger.error(traceback.format_exc())
            raise

    def get_master_key(self):
        """Retorna la master key actual"""
        return self.master_key

    def _derive_key(self, salt):
        """Deriva una clave usando HKDF"""
        try:
            logger.debug(f"Derivando clave con salt de longitud {len(salt)}")
            key_bytes = bytes.fromhex(self.master_key)
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

    def decrypt_with_master_key(self, encrypted_data):
        """Desencripta datos usando la master key"""
        try:
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
            logger.debug(f"Salt (hex): {salt.hex()[:20]}...")
            logger.debug(f"IV (hex): {iv.hex()}")
            
            # Derivar clave
            logger.debug("Derivando clave...")
            key = self._derive_key(salt)
            logger.debug(f"Clave derivada (longitud: {len(key)} bytes)")
            
            # Desencriptar usando AES-GCM
            logger.debug("Desencriptando datos...")
            aesgcm = AESGCM(key)
            plaintext = aesgcm.decrypt(iv, ciphertext, None)
            
            result = plaintext.decode()
            logger.info(f"Datos desencriptados correctamente (longitud: {len(result)})")
            logger.debug(f"Resultado (primeros 50 chars): {result[:50]}...")
            return result
            
        except Exception as e:
            logger.error(f"Error desencriptando con master key: {e}")
            logger.error(traceback.format_exc())
            return None

    def rotate_master_key(self):
        """Rota la master key actual por una nueva"""
        try:
            logger.info("Rotando master key...")
            old_key = self.master_key
            self.master_key = Fernet.generate_key().hex()
            
            # Guardar nueva key
            with open(self.key_file, 'wb') as f:
                f.write(bytes.fromhex(self.master_key))
            
            logger.info("Master key rotada correctamente")
            return {
                'old_key': old_key,
                'new_key': self.master_key
            }
        except Exception as e:
            logger.error(f"Error rotando master key: {e}")
            logger.error(traceback.format_exc())
            raise

# Crear instancia global
encryption_service = EncryptionService() 