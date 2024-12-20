# Documentación Backend - LOINC Search

## Arquitectura General

El backend está construido con Python utilizando Flask como framework principal. La arquitectura sigue un diseño modular y orientado a servicios, con las siguientes características principales:

- **API REST**: Endpoints para búsqueda y gestión
- **Procesamiento**: Módulos de análisis y transformación
- **Core**: Lógica de negocio central
- **Utilidades**: Funciones auxiliares y helpers
- **Prompts**: Templates predefinidos para IA

### Patrones de Diseño Utilizados

- **Factory**: Para creación de servicios
- **Strategy**: Para diferentes estrategias de búsqueda
- **Singleton**: Para conexiones y configuraciones
- **Repository**: Para acceso a datos

## Estructura del Proyecto

```
backend/
├── api/
│   └── [endpoints y controladores]
├── core/
│   └── [lógica de negocio]
├── processing/
│   └── [procesamiento de datos]
├── routes/
│   └── [definición de rutas]
├── utils/
│   └── [utilidades]
├── prompts/
│   ├── search/
│   │   └── [prompts de búsqueda]
│   └── analysis/
│       └── [prompts de análisis]
└── app.py
```

## Componentes Principales

### API (api/)

Endpoints principales:
- Búsqueda de términos LOINC
- Gestión de configuración
- Manejo de ontologías
- Integración con IA

### Core (core/)

Lógica de negocio central:
- Procesamiento de búsquedas
- Gestión de base de datos
- Manejo de caché
- Validaciones

### Processing (processing/)

Módulos de procesamiento:
- Análisis de texto
- Transformación de datos
- Normalización
- Enriquecimiento

### Routes (routes/)

Definición de rutas:
- Mapeo de endpoints
- Middleware
- Validaciones
- Documentación

### Utils (utils/)

Utilidades generales:
- Helpers de formato
- Manejo de errores
- Logging
- Configuración

### Prompts (prompts/)

Templates para IA:
- Prompts predefinidos por tipo:
  - search/: Prompts para búsqueda
  - analysis/: Prompts para análisis
- Configuración de agentes
- Plantillas de respuesta

## APIs y Endpoints

### Búsqueda

```python
@app.route('/api/search', methods=['POST'])
def search():
    """
    Búsqueda de términos LOINC
    
    Request:
    {
        "term": string,
        "config": {
            "ontologyMode": "multi_match" | "openai",
            "dbMode": "sql" | "elastic",
            "openai": {
                "useOriginalTerm": boolean,
                "useEnglishTerm": boolean,
                "useRelatedTerms": boolean,
                "useTestTypes": boolean,
                "useLoincCodes": boolean,
                "useKeywords": boolean
            }
        }
    }
    
    Response:
    {
        "results": [
            {
                "component": string,
                "loinc_code": string,
                "system": string,
                "method": string,
                "score": number
            }
        ],
        "metadata": {
            "total": number,
            "time": number,
            "filters": array
        }
    }
    """
```

### Configuración

```python
@app.route('/api/config', methods=['GET', 'POST'])
def config():
    """
    Gestión de configuración
    
    GET: Obtener configuración actual
    POST: Actualizar configuración
    
    Request POST:
    {
        "search": {...},
        "elastic": {...},
        "sql": {...},
        "loinc": {...}
    }
    
    Response:
    {
        "status": "success" | "error",
        "data": {...} | null,
        "message": string
    }
    """
```

### Prompts

```python
@app.route('/api/prompts', methods=['GET'])
def prompts():
    """
    Obtener lista de prompts disponibles
    
    Response:
    {
        "prompts": [
            {
                "id": string,
                "name": string,
                "provider": string,
                "model": string,
                "summary": string,
                "promptPath": string
            }
        ]
    }
    """
```

## Guía de Desarrollo

### Añadir Nuevo Endpoint

1. **Crear Ruta**:
   ```python
   from flask import Blueprint, jsonify, request
   from typing import Dict, Any

   new_endpoint = Blueprint('new_endpoint', __name__)

   @new_endpoint.route('/api/new', methods=['GET'])
   def new_function() -> Dict[str, Any]:
       """
       Descripción del endpoint
       
       Returns:
           Dict[str, Any]: Respuesta JSON
       """
       try:
           return jsonify({"status": "success"})
       except Exception as e:
           return jsonify({
               "status": "error",
               "message": str(e)
           }), 500
   ```

2. **Registrar Blueprint**:
   ```python
   from routes.new_endpoint import new_endpoint
   app.register_blueprint(new_endpoint)
   ```

### Implementar Nuevo Servicio

1. **Crear Clase**:
   ```python
   from typing import Dict, Any, Optional

   class NewService:
       def __init__(self, config: Optional[Dict[str, Any]] = None):
           self.config = config or {}

       def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
           """
           Procesa los datos según la configuración
           
           Args:
               data: Datos a procesar
               
           Returns:
               Dict con resultados
           """
           try:
               # Implementación
               return {"status": "success"}
           except Exception as e:
               raise ProcessingError(f"Error en proceso: {str(e)}")
   ```

2. **Integrar Servicio**:
   ```python
   from services.new_service import NewService
   from typing import Dict, Any

   def handle_request(data: Dict[str, Any]) -> Dict[str, Any]:
       service = NewService()
       return service.process(data)
   ```

## Mejores Prácticas

### Código

1. **Estructura**:
   - Módulos pequeños y enfocados
   - Separación de responsabilidades
   - Documentación clara

2. **Nomenclatura**:
   - snake_case para funciones y variables
   - PascalCase para clases
   - Nombres descriptivos en inglés

3. **Documentación**:
   - Docstrings en funciones
   - Tipos de parámetros
   - Ejemplos de uso

### API

1. **Endpoints**:
   - RESTful
   - Versionado
   - Documentación OpenAPI
   - Validación de entrada

2. **Respuestas**:
   - Códigos HTTP apropiados
   - Formato consistente
   - Manejo de errores

### Seguridad

1. **Validaciones**:
   - Sanitización de entrada
   - Validación de tipos
   - Límites y restricciones

2. **API Keys**:
   - Almacenamiento seguro
   - Rotación periódica
   - Validación de acceso

## Testing

### Unit Tests

```python
import pytest
from typing import Dict, Any

def test_search(client: Any) -> None:
    """Test de búsqueda básica"""
    result = client.post('/api/search', json={
        "term": "test",
        "config": {
            "ontologyMode": "multi_match",
            "dbMode": "sql"
        }
    })
    
    assert result.status_code == 200
    data = result.get_json()
    assert "results" in data
    assert len(data["results"]) >= 0
```

### Integration Tests

```python
def test_api_endpoint(client: Any) -> None:
    """Test de integración completo"""
    # Setup
    config = {
        "search": {
            "ontologyMode": "multi_match",
            "dbMode": "sql"
        }
    }
    
    # Test configuración
    config_response = client.post('/api/config', 
                                json=config)
    assert config_response.status_code == 200
    
    # Test búsqueda
    search_response = client.post('/api/search', 
                                json={"term": "test"})
    assert search_response.status_code == 200
    
    # Verificar resultados
    data = search_response.get_json()
    assert "results" in data
    assert "metadata" in data
```

## Deployment

1. **Preparación**:
   - Actualizar dependencias
   - Ejecutar tests
   - Verificar configuración

2. **Proceso**:
   - Build de la aplicación
   - Migración de base de datos
   - Deployment gradual

3. **Monitoreo**:
   - Logs
   - Métricas
   - Alertas

## Mantenimiento

### Logging

```python
import logging
from typing import Any

logging.info("Operación completada")
logging.error("Error en proceso", exc_info=True)

def log_operation(operation: str, data: Any) -> None:
    """Log estructurado de operaciones"""
    logging.info(f"Operation: {operation}", extra={
        "data": data,
        "timestamp": datetime.now().isoformat()
    })
```

### Error Handling

```python
from typing import Dict, Any

class CustomException(Exception):
    """Excepción base para errores personalizados"""
    pass

def handle_error(e: Exception) -> Dict[str, Any]:
    """Manejo centralizado de errores"""
    logging.error(f"Error: {str(e)}", exc_info=True)
    return {
        "status": "error",
        "message": str(e),
        "type": e.__class__.__name__
    }
```

## Contacto

Para dudas o sugerencias, preguntar al usuario.