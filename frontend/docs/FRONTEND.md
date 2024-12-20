# Documentación Frontend - LOINC Search

## Arquitectura General

El frontend está construido siguiendo una arquitectura modular basada en componentes, utilizando JavaScript vanilla y CSS moderno (sin dependencias de Node.js). La aplicación se divide en:

- **Componentes**: Elementos reutilizables de la UI
- **Servicios**: Lógica de negocio y comunicación con el backend
- **Utilidades**: Funciones auxiliares y helpers
- **Estilos**: CSS modular y responsivo

### Patrones de Diseño Utilizados

- **Singleton**: Para servicios globales como configuración y almacenamiento
- **Observer**: Para la comunicación entre componentes
- **Module Pattern**: Para encapsulación y organización del código

## Estructura del Proyecto

```
frontend/
├── static/
│   ├── css/
│   │   ├── components/
│   │   │   └── [estilos de componentes]
│   │   └── styles.css
│   └── js/
│       ├── components/
│       │   └── [componentes JS]
│       ├── services/
│       │   └── [servicios JS]
│       └── utils/
│           └── [utilidades JS]
├── templates/
│   └── components/
└── docs/
    └── FRONTEND.md
```

## Componentes Principales

### Modal de Configuración (config-modal.js)

El componente principal que maneja la configuración del sistema. Características:

- Gestión de pestañas para diferentes secciones:
  - Búsqueda
  - SQL
  - Elastic
  - AI
  - LOINC
  - Configuración

- Secciones principales:
  1. **Búsqueda**:
     - Configuración de ontología
     - Selección de base de datos
     - Opciones de OpenAI

  2. **SQL**:
     - Límites de búsqueda
     - Modo estricto
     - Configuración de resultados

  3. **Elastic**:
     - Tipos de búsqueda (exacta, fuzzy, smart)
     - Configuración de análisis
     - Opciones avanzadas

  4. **AI**:
     - Gestión de proveedores (OpenAI, Anthropic, Google)
     - Configuración de agentes
     - API keys

  5. **LOINC**:
     - Gestión de archivos
     - Estado del sistema
     - Importación de datos

  6. **Configuración**:
     - Borrado de datos
     - Restauración del sistema
     - Gestión de almacenamiento

### Servicio de Almacenamiento (storage.js)

Maneja el almacenamiento local de:
- Configuración de búsqueda
- API keys
- Estado de agentes
- Preferencias de usuario

## Guía de Desarrollo

### Añadir Nueva Funcionalidad

1. **Componentes**:
   ```javascript
   export class NewComponent {
       constructor() {
           this.init();
       }

       init() {
           // Inicialización
       }
   }
   ```

2. **Estilos**:
   ```css
   .component-name {
       /* Estilos base */
   }

   .component-name__element {
       /* Elementos internos */
   }
   ```

3. **Integración**:
   ```javascript
   import { newComponent } from './components/new-component.js';
   // Inicialización y uso
   ```

### Estructura de Configuración

```javascript
{
    search: {
        ontologyMode: 'multi_match' | 'openai',
        dbMode: 'sql' | 'elastic',
        openai: {
            useOriginalTerm: boolean,
            useEnglishTerm: boolean,
            useRelatedTerms: boolean,
            useTestTypes: boolean,
            useLoincCodes: boolean,
            useKeywords: boolean
        }
    },
    elastic: {
        limits: {
            maxTotal: number,
            maxPerKeyword: number
        },
        searchTypes: {
            exact: {
                enabled: boolean,
                priority: number
            },
            fuzzy: {
                enabled: boolean,
                tolerance: number
            },
            smart: {
                enabled: boolean,
                precision: number
            }
        }
    },
    sql: {
        maxTotal: number,
        maxPerKeyword: number,
        maxKeywords: number,
        strictMode: boolean
    },
    loinc: {
        filePath: string,
        lastUpdate: string
    },
    agents: [
        {
            id: string,
            name: string,
            enabled: boolean,
            provider: string,
            model: string,
            summary: string,
            promptPath: string
        }
    ]
}
```

## Mejores Prácticas

### Código

1. **Nomenclatura**:
   - Usar camelCase para variables y funciones
   - PascalCase para clases
   - Nombres descriptivos en español

2. **Organización**:
   - Un componente por archivo
   - Separar lógica de presentación
   - Mantener componentes pequeños y enfocados

3. **Eventos**:
   - Usar eventos personalizados para comunicación
   - Implementar delegación de eventos
   - Limpiar listeners en destrucción

### CSS

1. **Estructura**:
   - Seguir metodología BEM
   - Usar variables CSS
   - Mantener especificidad baja

2. **Responsive**:
   - Mobile-first approach
   - Breakpoints consistentes
   - Flexbox/Grid para layouts

### JavaScript

1. **Modularidad**:
   - Usar ES6 modules
   - Encapsular funcionalidad
   - Evitar variables globales

2. **Async/Await**:
   - Manejar promesas adecuadamente
   - Implementar manejo de errores
   - Usar try/catch

### LocalStorage

1. **Gestión**:
   - Usar storageService para todas las operaciones
   - Validar datos antes de guardar
   - Manejar errores de cuota y permisos

2. **Seguridad**:
   - No almacenar datos sensibles sin encriptar
   - Limpiar datos obsoletos
   - Validar integridad de datos

## Flujo de Trabajo

1. **Desarrollo**:
   - Crear rama feature/bugfix
   - Seguir guías de estilo
   - Documentar cambios
   - Testing local

2. **Testing**:
   - Probar en diferentes navegadores
   - Validar responsive design
   - Verificar performance
   - Probar persistencia en localStorage

3. **Deployment**:
   - Merge a desarrollo
   - Testing en staging
   - Deploy a producción

## Mantenimiento

### Debugging

1. **Console**:
   ```javascript
   console.debug('Información de desarrollo');
   console.error('Errores críticos');
   ```

2. **Try/Catch**:
   ```javascript
   try {
       // Operaciones críticas
   } catch (error) {
       console.error('Error:', error);
       // Manejo de error
   }
   ```

### Performance

1. **Optimizaciones**:
   - Lazy loading de componentes
   - Minimizar manipulación DOM
   - Cachear elementos frecuentes
   - Optimizar uso de localStorage

2. **Monitoreo**:
   - Usar Chrome DevTools
   - Implementar logging
   - Monitorear eventos críticos
   - Verificar uso de almacenamiento

## Contacto

Para dudas o sugerencias, preguntar al usuario.