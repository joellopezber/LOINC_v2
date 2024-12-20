import os
import json
from flask import Blueprint, jsonify

prompts_bp = Blueprint('prompts', __name__)

PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'prompts')

def load_prompt(category, filename='prompt.json'):
    """Carga un prompt desde un archivo JSON."""
    try:
        with open(os.path.join(PROMPTS_DIR, category, filename), 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading prompt from {category}/{filename}: {e}")
        return None

@prompts_bp.route('/api/prompts', methods=['GET'])
def get_prompts():
    """Retorna todos los prompts disponibles."""
    prompts = []
    
    # Recorrer todas las carpetas en el directorio de prompts
    for category in os.listdir(PROMPTS_DIR):
        category_dir = os.path.join(PROMPTS_DIR, category)
        if os.path.isdir(category_dir):
            prompt = load_prompt(category)
            if prompt:
                prompts.append(prompt)
    
    return jsonify(prompts)

@prompts_bp.route('/api/prompts/<prompt_id>', methods=['GET'])
def get_prompt(prompt_id):
    """Retorna un prompt específico por su ID."""
    # Recorrer las carpetas buscando el prompt con el ID especificado
    for category in os.listdir(PROMPTS_DIR):
        category_dir = os.path.join(PROMPTS_DIR, category)
        if os.path.isdir(category_dir):
            prompt = load_prompt(category)
            if prompt and prompt.get('id') == prompt_id:
                return jsonify(prompt)
    
    return jsonify({'error': 'Prompt not found'}), 404 