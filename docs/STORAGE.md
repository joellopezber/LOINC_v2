# Sistema de Almacenamiento - Documentación Técnica

## 1. Arquitectura General

### 1.1 Componentes Principales
```
Frontend                          Backend
┌─────────────────┐              ┌─────────────────┐
│  LocalStorage   │              │  StorageService │
└────────┬────────┘              └────────┬────────┘
         │                                │
┌────────┴────────┐              ┌────────┴────────┐
│ StorageService  │◄────────────►│   WebSocket    │
└────────┬────────┘              └────────┬────────┘
         │                                │
┌────────┴────────┐              ┌────────┴────────┐
│    WebSocket    │◄────────────►│  Encryption    │
└─────────────────┘              └─────────────────┘
```

### 1.2 Flujo de Datos
1. Los datos se almacenan localmente en `LocalStorage`
2. `StorageService` orquesta la sincronización
3. `WebSocket` maneja la comunicación
4. El backend separa datos por usuario usando `installId`

## 2. Componentes Frontend

### 2.1 LocalStorage (`storage.js`)
Gestión pura del almacenamiento local.

#### Métodos Principales
```javascript
class LocalStorage {
    // Inicialización
    async initialize(): Promise<boolean>
    
    // Operaciones Básicas
    get(key: string): any
    set(key: string, value: any): boolean
    remove(key: string): boolean
    
    // Gestión de Configuración
    async getConfig(): Promise<Config>
    async setConfig(config: Config): Promise<boolean>
    
    // Backup
    async createBackup(): Promise<boolean>
    async restoreFromBackup(): Promise<boolean>
    
    // Validación
    validateConfig(config: any): boolean
    validateConfigValue(value: any, schema: any): boolean
}
```

#### Tipos de Configuración
```javascript
const configSchema = {
    search: {
        ontologyMode: ['multi_match', 'openai'],
        dbMode: ['sql', 'elastic'],
        openai: {
            useOriginalTerm: 'boolean',
            useEnglishTerm: 'boolean',
            useRelatedTerms: 'boolean',
            useTestTypes: 'boolean',
            useLoincCodes: 'boolean',
            useKeywords: 'boolean'
        }
    },
    sql: {
        maxTotal: 'number',
        maxPerKeyword: 'number',
        maxKeywords: 'number',
        strictMode: 'boolean'
    },
    elastic: {
        limits: {
            maxTotal: 'number',
            maxPerKeyword: 'number'
        },
        searchTypes: {
            exact: {
                enabled: 'boolean',
                priority: 'number'
            },
            fuzzy: {
                enabled: 'boolean',
                tolerance: 'number'
            },
            smart: {
                enabled: 'boolean',
                precision: 'number'
            }
        },
        showAdvanced: 'boolean'
    },
    performance: {
        maxCacheSize: 'number',
        cacheExpiry: 'number'
    }
}
```

### 2.2 StorageService (`storage.service.js`)
Orquestador entre almacenamiento local y remoto.

#### Tipos de Almacenamiento
```javascript
storageTypes = {
    'searchConfig': {
        sync: true,
        cache: true,
        validate: (value) => value && typeof value === 'object'
    },
    'ontologyResults': {
        sync: true,
        cache: true,
        validate: (value) => value && typeof value === 'object'
    },
    'openaiApiKey': {
        sync: true,
        encrypt: true,
        validate: (value) => typeof value === 'string'
    }
}
```

#### Métodos Principales
```javascript
class StorageService {
    // Inicialización
    async initialize(): Promise<boolean>
    
    // Operaciones de Datos
    async get(key: string): Promise<any>
    async set(key: string, value: any): Promise<boolean>
    
    // Caché
    _getFromCache(key: string): any
    _setInCache(key: string, value: any): void
    
    // Sincronización
    async _syncWithServer(options = {}): Promise<boolean>
    async _getLocalData(): Promise<object>
    
    // Eventos WebSocket
    _handleWebSocketConnect(): Promise<void>
    _handleWebSocketReconnect(): Promise<void>
}
```

### 2.3 WebSocket Service (`websocket.service.js`)
Gestión de la comunicación en tiempo real.

#### Métodos Principales
```javascript
class WebSocketService {
    // Conexión
    async connect(): Promise<Socket>
    async disconnect(): Promise<void>
    
    // Eventos
    on(event: string, handler: Function): void
    off(event: string, handler: Function): void
    _emit(event: string, data: any): void
    
    // Comunicación
    async sendRequest(event: string, data: any): Promise<any>
    
    // Configuración
    _setupEventHandlers(): void
}
```

## 3. Componentes Backend

### 3.1 Storage Service (`storage_service.py`)
Gestión del almacenamiento en el servidor.

#### Métodos Principales
```python
class StorageService:
    # Operaciones de Datos
    def get_value(key: str, install_id: str) -> Any
    def set_value(key: str, value: Any, install_id: str) -> bool
    def get_all_for_user(install_id: str) -> Dict[str, Any]
    
    # Gestión de Usuario
    def _get_user_storage(install_id: str) -> dict
    def _has_value_changed(key: str, new_value: Any, install_id: str) -> bool
    
    # Eventos
    def emit_update(key: str, value: Any, install_id: str)
    
    # OpenAI
    def get_credentials(install_id: str) -> Optional[str]
    def process_openai_test(install_id: str) -> Optional[Dict[str, Any]]
```

### 3.2 WebSocket Service (`websocket_service.py`)
Gestión de conexiones WebSocket en el servidor.

#### Eventos Soportados
```python
# Conexión
'connect': Maneja nueva conexión
'disconnect': Maneja desconexión

# Storage
'storage.set_value': Guarda valor
'storage.get_value': Obtiene valor
'storage.value_updated': Notifica actualización

# Encryption
'encryption.get_master_key': Obtiene clave maestra
```

## 4. Seguridad

### 4.1 Separación de Datos
- Cada usuario tiene su propio espacio de almacenamiento
- Se usa `installId` como identificador único
- Los datos se almacenan en estructuras separadas

### 4.2 Encriptación
- Las API keys se encriptan antes de almacenarse
- Se usa el `installId` como parte de la clave de encriptación
- La encriptación/desencriptación ocurre en el backend

### 4.3 WebSocket
- Cada conexión se identifica con `installId`
- Las actualizaciones se envían solo al usuario correcto
- Se usa sistema de rooms para aislar mensajes

## 5. Uso del Sistema

### 5.1 Inicialización
```javascript
// 1. Inicializar localStorage
await storage.initialize();

// 2. Conectar WebSocket
await websocketService.connect();

// 3. Inicializar StorageService
await storageService.initialize();
```

### 5.2 Operaciones Comunes
```javascript
// Guardar datos
await storageService.set('searchConfig', config);

// Obtener datos
const config = await storageService.get('searchConfig');

// Escuchar cambios
storageService.on('value_updated', (data) => {
    console.log('Valor actualizado:', data);
});
```

### 5.3 Manejo de Errores
```javascript
try {
    await storageService.set('key', value);
} catch (error) {
    console.error('Error guardando datos:', error);
    // Mostrar mensaje al usuario
}
``` 