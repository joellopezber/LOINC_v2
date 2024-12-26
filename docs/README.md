# LOINC Search - Documentación General

## Descripción del Proyecto

LOINC Search es una aplicación web diseñada para facilitar la búsqueda y gestión de términos LOINC (Logical Observation Identifiers Names and Codes). El sistema utiliza tecnologías modernas de procesamiento de lenguaje natural e inteligencia artificial para mejorar la precisión y relevancia de las búsquedas.

## Documentación

La documentación completa del proyecto se encuentra en el archivo `LOINC_SEARCH.md`, que incluye:

1. **Visión General**: Descripción y objetivos del proyecto
2. **Estructura**: Organización de archivos y componentes
3. **Arquitectura**: Frontend, Backend y Base de datos
4. **Funcionalidades**: Búsqueda, análisis y configuración
5. **Seguridad**: Encriptación y validación
6. **Testing**: Pruebas y calidad
7. **Desarrollo**: Guías y estándares
8. **Mantenimiento**: Actualizaciones y soporte

## Requisitos del Sistema

### Software
- Python 3.8+
- Flask
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

3. **Configuración**:
   - Copiar `.env.example` a `.env`
   - Configurar variables de entorno
   - Configurar conexiones a bases de datos

## Uso

1. **Iniciar Backend**:
   ```bash
   ./run.sh
   ```

2. **Acceder a la Aplicación**:
   - Abrir navegador en `http://localhost:5001`
   - Configurar opciones iniciales
   - Comenzar a usar

3. **API Endpoints**:
   ```bash
   # Verificar estado
   GET /api/health

   # Búsqueda LOINC
   GET /api/loinc/search?q=glucose&limit=10

   # Inserción masiva
   POST /api/loinc/bulk
   Content-Type: application/json
   Body: [{"code": "1234-5", ...}, ...]
   ```

## Desarrollo

### Flujo de Trabajo
1. Crear rama feature/bugfix
2. Seguir guías de estilo
3. Documentar cambios
4. Testing local
5. Pull Request

### Testing
```bash
# Backend
python -m pytest

# Frontend
# Tests manuales de UI
```

## Mantenimiento

### Logs
- Nivel DEBUG para desarrollo
- Rotación de logs configurada
- Alertas automatizadas

### Monitoreo
- Tiempos de respuesta
- Uso de recursos
- Errores y excepciones

## Contribución

1. Fork del repositorio
2. Crear feature branch
3. Commit cambios
4. Push al branch
5. Crear Pull Request

## Licencia

Este proyecto está bajo la licencia MIT.

## Soporte

Para soporte y consultas:
- Issues en GitHub
- Documentación en `LOINC_SEARCH.md`
- Email: [EMAIL] 