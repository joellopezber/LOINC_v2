import os
import logging
from openai import OpenAI
from typing import Optional, Dict, Any, List
from .encryption_service import encryption_service

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Valores por defecto
DEFAULT_MODEL = "gpt-4o"
DEFAULT_TEMPERATURE = 0.7
DEFAULT_SYSTEM_PROMPT = """Responde la pregunta del usuario de manera clara y concisa."""

class OpenAIService:
    def __init__(self):
        """Inicializa el servicio de OpenAI"""
        self.client = None
        self.initialized = False
        logger.info("🤖 Servicio OpenAI creado")

    def initialize_with_encrypted(self, encrypted_key: str, install_timestamp: str) -> bool:
        """
        Inicializa el servicio usando una API key encriptada
        Args:
            encrypted_key: API key encriptada
            install_timestamp: Timestamp de instalación para desencriptar
        Returns:
            bool: True si la inicialización fue exitosa
        """
        try:
            # 1. Desencriptar API Key
            logger.info("\n🔄 Desencriptando API Key...")
            api_key = encryption_service.decrypt(encrypted_key, install_timestamp)
            
            if not api_key:
                logger.error("❌ Error al desencriptar la API key")
                return False

            # Mostrar key enmascarada
            masked_key = f"{api_key[:4]}...{api_key[-4:]}"
            logger.info(f"🔓 API Key desencriptada: {masked_key}")

            # 2. Inicializar con la key desencriptada
            return self.initialize(api_key)

        except Exception as e:
            logger.error(f"❌ Error en initialize_with_encrypted: {e}")
            return False

    def initialize(self, api_key: str) -> bool:
        """Inicializa el servicio OpenAI con la API key proporcionada"""
        try:
            if not api_key or not api_key.startswith('sk-'):
                logger.error("❌ API key inválida")
                return False
                
            self.client = OpenAI(api_key=api_key)
            self.initialized = True
            logger.info("✅ Cliente OpenAI inicializado")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error inicializando OpenAI: {e}")
            return False

    def process_query(
        self, 
        user_prompt: str,
        model: str = DEFAULT_MODEL,
        temperature: float = DEFAULT_TEMPERATURE,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        chat_history: List[Dict[str, str]] = None
    ) -> Optional[str]:
        """
        Procesa una consulta usando OpenAI
        Args:
            user_prompt: Texto de la consulta (obligatorio)
            model: Modelo a usar (default: gpt-4o)
            temperature: Temperatura para la respuesta (default: 0.7)
            system_prompt: Prompt de sistema (default: prompt básico)
            chat_history: Historial de conversación (default: None)
        Returns:
            Respuesta de OpenAI o None si hay error
        """
        if not self.initialized:
            logger.error("❌ Cliente no inicializado")
            return None

        if not user_prompt:
            logger.error("❌ Se requiere user_prompt")
            return None

        try:
            # Log de parámetros usados
            logger.info(f"🔄 Procesando consulta:")
            logger.info(f"📝 Modelo: {model}")
            logger.info(f"🌡️ Temperatura: {temperature}")
            
            # Construir mensajes
            messages = [{"role": "system", "content": system_prompt}]
            
            # Añadir historial si existe
            if chat_history:
                # Filtrar el último mensaje si es del usuario (evitar duplicados)
                filtered_history = chat_history[:-1] if chat_history and chat_history[-1]['role'] == 'user' else chat_history
                
                for msg in filtered_history:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            # Añadir mensaje actual
            messages.append({"role": "user", "content": user_prompt})

            # Log de mensajes para debug
            logger.debug("📨 Mensajes enviados a OpenAI:")
            for msg in messages:
                logger.debug(f"- [{msg['role']}]: {msg['content'][:50]}...")

            response = self.client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=messages
            )
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"❌ Error procesando consulta: {e}")
            return None

# Crear instancia global
openai_service = OpenAIService() 