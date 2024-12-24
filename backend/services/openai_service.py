import os
import logging
from openai import OpenAI
from typing import Optional

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Valores por defecto
DEFAULT_MODEL = "gpt-4"
DEFAULT_TEMPERATURE = 0.7
DEFAULT_SYSTEM_PROMPT = """Responde la pregunta del usuario de manera clara y concisa."""

class OpenAIService:
    def __init__(self):
        """Inicializa el servicio de OpenAI"""
        self.client = None
        self.initialized = False
        logger.info("🤖 Servicio OpenAI creado")

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
        system_prompt: str = DEFAULT_SYSTEM_PROMPT
    ) -> Optional[str]:
        """
        Procesa una consulta usando OpenAI
        Args:
            user_prompt: Texto de la consulta (obligatorio)
            model: Modelo a usar (default: gpt-4)
            temperature: Temperatura para la respuesta (default: 0.7)
            system_prompt: Prompt de sistema (default: LOINC expert)
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

            response = self.client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"❌ Error procesando consulta: {e}")
            return None

# Crear instancia global
openai_service = OpenAIService() 