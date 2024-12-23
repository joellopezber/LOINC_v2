from cryptography.fernet import Fernet
import os
import logging

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
            else:
                logger.info("Generando nueva master key...")
                self.master_key = Fernet.generate_key().hex()
                with open(self.key_file, 'wb') as f:
                    f.write(bytes.fromhex(self.master_key))
                logger.info("Nueva master key generada y guardada")
        except Exception as e:
            logger.error(f"Error inicializando encryption service: {e}")
            raise

    def get_master_key(self):
        """Retorna la master key actual"""
        return self.master_key

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
            raise

# Crear instancia global
encryption_service = EncryptionService() 