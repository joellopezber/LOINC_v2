#!/bin/bash

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Verificar si flask está instalado (como indicador de todas las dependencias)
if ! python -c "import flask" &> /dev/null; then
    echo "📦 Instalando dependencias..."
    pip install -r requirements.txt
fi

# Ejecutar servidor
echo "🚀 Iniciando servidor..."
python backend/app.py 