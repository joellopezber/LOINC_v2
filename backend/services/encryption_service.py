from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import logging
import base64
import traceback
import hashlib
from dotenv import load_dotenv
from pathlib import Path

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Obtener el directorio raíz del proyecto (2 niveles arriba desde este archivo)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent

# Cargar variables de entorno desde el directorio raíz
load_dotenv(ROOT_DIR / '.env')

class EncryptionService:
    def __init__(self):
        """Inicializa el servicio de encriptación"""
        logger.info("Inicializando encryption service...")
        
        # Obtener el salt del archivo .env
        env_salt = os.getenv('SALT_MASTER_KEY')
        if not env_salt:
            logger.error("❌ SALT_MASTER_KEY no encontrado en .env")
            raise ValueError("SALT_MASTER_KEY debe estar configurado en el archivo .env")
            
        # Convertir el salt hexadecimal a bytes
        try:
            self.server_salt = bytes.fromhex(env_salt)
            logger.info("✅ SALT_MASTER_KEY cargado correctamente")
        except ValueError as e:
            logger.error("❌ Error al decodificar SALT_MASTER_KEY: debe ser una cadena hexadecimal válida")
            raise ValueError("SALT_MASTER_KEY debe ser una cadena hexadecimal válida") from e
            
        self.install_keys = {}  # Diccionario para almacenar claves por installTimestamp
    
    def generate_deterministic_key(self, install_timestamp):
        """
        Genera una master key determinista basada en el installTimestamp.
        Usa PBKDF2 para derivar una clave segura y la devuelve en formato hexadecimal.
        """
        # Convertir timestamp a bytes
        timestamp_bytes = str(install_timestamp).encode()
        
        # Usar PBKDF2 para derivar una clave segura
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,  # 32 bytes = 256 bits
            salt=self.server_salt,
            iterations=100000,
        )
        
        # Derivar la clave y convertirla a hexadecimal
        key_bytes = kdf.derive(timestamp_bytes)
        return key_bytes.hex()

    def get_key_for_install(self, install_timestamp):
        """
        Obtiene la master key para una instalación específica.
        La clave se genera de forma determinista basada en el installTimestamp.
        """
        if install_timestamp not in self.install_keys:
            # Generar la clave de forma determinista
            self.install_keys[install_timestamp] = self.generate_deterministic_key(install_timestamp)
        
        return self.install_keys[install_timestamp]

    def _derive_key(self, salt, master_key):
        """
        Deriva una clave secundaria para un propósito específico.
        Útil para generar claves diferentes para diferentes usos (ej: API keys, datos, etc.)
        """
        # Convertir master_key de hex a bytes
        key_bytes = bytes.fromhex(master_key)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=50000,
        )
        return base64.urlsafe_b64encode(kdf.derive(key_bytes))

    def encrypt(self, data, install_timestamp):
        """Encripta datos usando la master key de la instalación"""
        try:
            if not data:
                return None
                
            master_key = self.get_key_for_install(install_timestamp)
            # Generar una sal única para esta encriptación
            salt = os.urandom(16)
            # Derivar una clave específica para esta encriptación
            key = self._derive_key(salt, master_key)
            
            f = Fernet(key)
            encrypted_data = f.encrypt(data.encode())
            
            # Combinar sal y datos encriptados
            return base64.urlsafe_b64encode(salt + encrypted_data).decode()
        except Exception as e:
            logger.error(f"Error en encriptación: {e}")
            logger.error(traceback.format_exc())
            return None

    def decrypt(self, encrypted_data, install_timestamp):
        """Desencripta datos usando la master key de la instalación"""
        try:
            if not encrypted_data:
                return None
                
            # Decodificar datos
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
            # Extraer sal (primeros 16 bytes)
            salt = decoded_data[:16]
            # Extraer datos encriptados
            encrypted = decoded_data[16:]
            
            # Obtener master key y derivar clave específica
            master_key = self.get_key_for_install(install_timestamp)
            key = self._derive_key(salt, master_key)
            
            f = Fernet(key)
            decrypted_data = f.decrypt(encrypted)
            return decrypted_data.decode()
        except Exception as e:
            logger.error(f"Error en desencriptación: {e}")
            logger.error(traceback.format_exc())
            return None

# Crear instancia global
encryption_service = EncryptionService() 