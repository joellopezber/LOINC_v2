#!/bin/bash

# Colores para los mensajes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Activar entorno virtual si existe
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Verificar si Flask está instalado
if ! python -c "import flask" &> /dev/null; then
    echo -e "${BLUE}📦 Instalando dependencias...${NC}"
    pip install -r requirements.txt
fi

# Configurar variables de entorno para Flask
export FLASK_ENV=production  # Cambiar a production para evitar el reloader
export FLASK_DEBUG=0
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Ejecutar directamente el archivo app.py
python backend/app.py

# Desactivar entorno virtual al salir
trap "deactivate" EXIT