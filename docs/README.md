# LOINC Search - Documentación General

## Descripción del Proyecto

LOINC Search es una aplicación web diseñada para facilitar la búsqueda y gestión de términos LOINC (Logical Observation Identifiers Names and Codes). El sistema utiliza tecnologías modernas de procesamiento de lenguaje natural e inteligencia artificial para mejorar la precisión y relevancia de las búsquedas.

## Características Principales

1. **Búsqueda Inteligente**:
   - Procesamiento ontológico
   - Análisis semántico
   - Múltiples motores de búsqueda (SQL/Elasticsearch)

2. **Integración con IA**:
   - OpenAI
   - Anthropic
   - Google AI

3. **Gestión de Datos**:
   - Importación de archivos LOINC
   - Gestión de ontologías
   - Configuración flexible

## Arquitectura del Sistema

### Frontend (JavaScript + CSS)
- Interfaz de usuario moderna y responsiva
- Gestión de estado local
- Componentes modulares
- [Documentación Frontend](frontend/docs/FRONTEND.md)

### Backend (Python + Flask)
- API REST
- Procesamiento de datos
- Integración con servicios de IA
- [Documentación Backend](backend/docs/BACKEND.md)

## Requisitos del Sistema

### Software
- Python 3.8+
- Node.js 14+
- Elasticsearch 7.x
- MySQL/PostgreSQL

### Hardware Recomendado
- CPU: 4+ cores
- RAM: 8GB+
- Almacenamiento: 20GB+

## Instalación

1. **Clonar Repositorio**:
   ```bash
   git clone [URL_REPOSITORIO]
   cd LOINC_v2
   ```

2. **Backend**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # o
   .\\venv\\Scripts\\activate  # Windows
   pip install -r requirements.txt
   ```

3. **Frontend**:
   ```bash
   cd frontend
   # No requiere instalación adicional
   ```

4. **Configuración**:
   - Copiar `.env.example` a `.env`
   - Configurar variables de entorno
   - Configurar conexiones a bases de datos

## Uso

1. **Iniciar Backend**:
   ```bash
   ./run.sh
   ```

2. **Acceder a la Aplicación**:
   - Abrir navegador en `http://localhost:5000`
   - Configurar opciones iniciales
   - Comenzar a usar

## Configuración

### Archivo de Configuración
```json
{
    "search": {
        "ontologyMode": "multi_match",
        "dbMode": "sql"
    },
    "elastic": {
        // Configuración Elasticsearch
    },
    "sql": {
        // Configuración SQL
    }
}
```

### Variables de Entorno
```env
FLASK_ENV=development
OPENAI_API_KEY=sk-...
DB_CONNECTION=...
```

## Desarrollo

### Estructura del Proyecto
```
LOINC_v2/
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   └── js/
│   └── templates/
├── backend/
│   ├── api/
│   ├── core/
│   └── processing/
├── config/
├── data/
└── tests/
```

### Flujo de Desarrollo

1. **Feature Branch**:
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```

2. **Desarrollo**:
   - Seguir guías de estilo
   - Documentar cambios
   - Añadir tests

3. **Testing**:
   ```bash
   python -m pytest
   ```

4. **Pull Request**:
   - Descripción clara
   - Referencias a issues
   - Revisión de código

## Testing

### Backend
```bash
python -m pytest tests/
```

### Frontend
- Tests manuales de UI
- Validación de responsive design
- Pruebas de integración

## Deployment

1. **Preparación**:
   - Actualizar dependencias
   - Ejecutar tests
   - Build de assets

2. **Deployment**:
   - Configurar servidor
   - Migrar base de datos
   - Deploy aplicación

3. **Verificación**:
   - Pruebas de smoke
   - Monitoreo inicial
   - Validación de funcionalidad

## Mantenimiento

### Logs
- `/var/log/loinc/app.log`
- `/var/log/loinc/error.log`

### Backups
- Base de datos: Diario
- Configuración: Por cambio
- Ontología: Semanal

### Monitoreo
- Uso de CPU/RAM
- Tiempos de respuesta
- Errores y excepciones

## Contribución

1. Fork del repositorio
2. Crear feature branch
3. Commit cambios
4. Push al branch
5. Crear Pull Request

## Licencia

Este proyecto está bajo la licencia [LICENCIA].

## Contacto

Para soporte o consultas:
- Email: [EMAIL]
- Issues: GitHub Issues
- Documentación: Wiki del proyecto 