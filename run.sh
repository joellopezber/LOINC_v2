#!/bin/bash

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor
python backend/app.py 