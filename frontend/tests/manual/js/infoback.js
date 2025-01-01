import { BaseTester } from './base.js';
import { storageService } from '../../../static/js/services/storage.service.js';

class StorageTest extends BaseTester {
    constructor() {
        super();
        this.initialized = false;
        this._disableAutoSync();
        this._saveOriginalFunctions();
        this._overrideFunctions();
    }

    _disableAutoSync() {
        storageService.pendingSync = false;
        storageService.wsConfigured = true;
        storageService.autoSync = false;
        storageService.syncQueue = [];
    }

    _saveOriginalFunctions() {
        this.originalQueueSync = storageService.queueSync;
    }

    _overrideFunctions() {
        storageService._setupWebSocket = () => {};
        storageService.queueSync = async (options = {}) => {
            if (!options.force) return Promise.resolve(false);
            return this.originalQueueSync.call(storageService, options);
        };
        storageService.processQueue = () => Promise.resolve(false);
        storageService.initialize = async () => {
            storageService.initialized = true;
            storageService.initializing = false;
            return Promise.resolve(true);
        };
    }

    async initialize() {
        try {
            if (!this.initialized) {
                await storageService.initialize();
                this.initialized = true;
                console.log('✅ Storage Service inicializado');
            }
        } catch (error) {
            console.error('❌ Error:', error);
            throw error;
        }
    }

    async syncWithBackend() {
        try {
            console.log('🔄 Sincronizando con backend');
            if (!this._ws.isConnected()) {
                throw new Error('No hay conexión WebSocket');
            }

            // Obtener datos críticos para sincronización
            const syncData = await this._collectData();
            
            // Enviar cada dato al backend
            for (const [key, value] of Object.entries(syncData)) {
                if (value !== null) {
                    // No sincronizar installTimestamp, es un valor especial
                    if (key !== 'installTimestamp') {
                        await this._ws.sendRequest('storage.set_value', {
                            key,
                            value,
                            install_id: localStorage.getItem('installTimestamp')
                        });
                    }
                }
            }

            console.log('✅ Sincronización completada');
        } catch (error) {
            console.error('❌ Error:', error);
            throw error;
        }
    }

    async _collectData() {
        // Datos críticos para sincronización
        const syncData = {
            searchConfig: await storageService.get('searchConfig'),
            openaiApiKey: await storageService.get('openaiApiKey'),
            installTimestamp: await storageService.get('installTimestamp'),
            ontologyResults: await storageService.get('ontologyResults')
        };

        console.log('📤 Datos para sincronizar:', {
            searchConfig: !!syncData.searchConfig,
            openaiApiKey: !!syncData.openaiApiKey,
            installTimestamp: !!syncData.installTimestamp,
            ontologyResults: !!syncData.ontologyResults
        });

        return syncData;
    }

    async getAllData() {
        try {
            // Obtener llaves de localStorage
            const localStorageKeys = Object.keys(localStorage);
            
            // Recolectar datos
            const allData = await this._collectAllData(localStorageKeys);
            
            // Función para verificar si un valor está realmente definido
            const hasRealValue = (value) => {
                if (value === null || value === undefined) return false;
                if (typeof value === 'object') {
                    if (Array.isArray(value)) return value.length > 0;
                    return Object.keys(value).length > 0;
                }
                return true;
            };
            
            // Preparar resumen (solo contar llaves con valores reales)
            const summary = {
                backend: {
                    keys: Object.entries(allData.backend)
                        .filter(([_, value]) => hasRealValue(value))
                        .map(([key]) => key),
                    count: Object.values(allData.backend)
                        .filter(value => hasRealValue(value))
                        .length
                },
                frontend: {
                    keys: Object.entries(allData.frontend)
                        .filter(([_, value]) => hasRealValue(value))
                        .map(([key]) => key),
                    count: Object.values(allData.frontend)
                        .filter(value => hasRealValue(value))
                        .length
                }
            };

            console.log('📊 Resumen de datos:', summary);

            return { 
                backendKeys: Object.keys(allData.backend), // Mantener todas las llaves para mostrar
                localStorageKeys: Object.keys(allData.frontend), // Mantener todas las llaves para mostrar
                data: allData,
                summary // Agregar el resumen para usar en la presentación
            };
        } catch (error) {
            console.error('❌ Error:', error);
            throw error;
        }
    }

    async _collectAllData(localStorageKeys) {
        const allData = {
            frontend: {},  // Datos del localStorage (via storage.js)
            backend: {}    // Datos del backend (via storage_service.py)
        };
        
        // 1. Obtener datos del backend via WebSocket directo
        if (this._ws.isConnected()) {
            const install_id = localStorage.getItem('installTimestamp');
            if (!install_id) {
                console.warn('⚠️ No hay install_id para obtener datos del backend');
                return allData;
            }

            try {
                console.log('📤 Solicitando datos del backend...');
                // Obtener todos los datos del usuario del backend con timeout de 10s
                const response = await this._ws.sendRequest('storage.get_all_for_user', {
                    install_id
                }, 10000); // 10 segundos de timeout

                if (response && response.status === 'success' && response.data) {
                    allData.backend = response.data;
                    console.log('📥 Estado actual del backend:', response.data);
                } else {
                    console.warn('⚠️ Respuesta inválida del backend:', response);
                }
            } catch (error) {
                console.error('❌ Error obteniendo datos del backend:', error);
                if (error.message.includes('Timeout')) {
                    console.warn('⚠️ El servidor tardó demasiado en responder');
                }
            }
        } else {
            console.warn('⚠️ No hay conexión WebSocket para obtener datos del backend');
        }

        // 2. Obtener datos del localStorage via storage.js
        for (const key of localStorageKeys) {
            try {
                const value = localStorage.getItem(key);
                if (value !== null) {
                    try {
                        allData.frontend[key] = JSON.parse(value);
                    } catch {
                        allData.frontend[key] = value;
                    }
                }
            } catch (error) {
                console.error(`❌ Error frontend [${key}]:`, error);
            }
        }

        return allData;
    }

    async clearBackendMemory() {
        try {
            console.log('🗑️ Limpiando memoria');
            if (!this._ws.isConnected()) {
                throw new Error('No hay conexión WebSocket');
            }

            const install_id = localStorage.getItem('installTimestamp');
            if (!install_id) {
                throw new Error('No hay install_id para limpiar la memoria');
            }

            // Obtener todas las claves del backend
            console.log('📤 Solicitando datos actuales del backend...');
            const response = await this._ws.sendRequest('storage.get_all_for_user', { install_id });
            console.log('📥 Datos actuales del backend:', response);
            
            if (response.status !== 'success') {
                throw new Error('Error obteniendo datos del backend');
            }

            // Valores por defecto según validación del backend
            const defaultValues = {
                'searchConfig': { initialized: true },
                'openaiApiKey': 'sk-reset',
                'installTimestamp': install_id,
                'ontologyResults': {
                    default: {
                        data: {},
                        timestamp: Date.now(),
                        searchCount: 0
                    }
                }
            };

            console.log('🔄 Valores por defecto a establecer:', defaultValues);
            console.log('🔄 Claves a procesar:', Object.keys(response.data));

            // Limpiar cada clave con su valor por defecto
            for (const key of Object.keys(response.data)) {
                if (key in defaultValues) {
                    const payload = {
                        key,
                        value: defaultValues[key],
                        install_id
                    };
                    console.log('📤 Enviando payload para', key + ':', JSON.stringify(payload, null, 2));
                    try {
                        const result = await this._ws.sendRequest('storage.set_value', payload);
                        console.log('📥 Respuesta para', key + ':', result);
                    } catch (error) {
                        console.error('❌ Error procesando', key + ':', error);
                        throw error;
                    }
                }
            }

            console.log('✅ Memoria limpiada');
        } catch (error) {
            console.error('❌ Error:', error);
            throw error;
        }
    }
}

function displayResult(elementId, data) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('❌ Elemento no encontrado:', elementId);
        return;
    }

    // Función para verificar si un valor está realmente definido
    const hasRealValue = (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'object') {
            if (Array.isArray(value)) return value.length > 0;
            return Object.keys(value).length > 0;
        }
        return true;
    };

    element.classList.add('results', 'visible');

    const html = `
        <div id="backendSection" class="section">
            <div class="section-title">Datos en Backend (${data.summary.backend.count} con valor / ${data.backendKeys.length} total)</div>
            <div class="tag-list">
                ${data.backendKeys.map(key => {
                    const hasValue = hasRealValue(data.data.backend[key]);
                    return `<span class="tag ${hasValue ? 'has-value' : ''}">${key}</span>`;
                }).join('')}
            </div>
            <div class="data-list">
                ${Object.entries(data.data.backend).map(([key, value]) => `
                    <div class="loinc-code" onclick="toggleSection('backend-${key}')" style="cursor: pointer; width: 100%; margin-bottom: 5px;">
                        <span class="code">${key}</span>
                        <span class="description">${getPreview(value)}</span>
                    </div>
                    <div id="content-backend-${key}" class="json-viewer" style="display: none; width: 100%;">
                        ${formatValue(value)}
                    </div>
                `).join('')}
            </div>
        </div>

        <div id="frontendSection" class="section">
            <div class="section-title">Datos en LocalStorage (${data.summary.frontend.count} con valor / ${data.localStorageKeys.length} total)</div>
            <div class="tag-list">
                ${data.localStorageKeys.map(key => {
                    const hasValue = hasRealValue(data.data.frontend[key]);
                    return `<span class="tag ${hasValue ? 'has-value' : ''}">${key}</span>`;
                }).join('')}
            </div>
            <div class="data-list">
                ${Object.entries(data.data.frontend).map(([key, value]) => `
                    <div class="loinc-code" onclick="toggleSection('frontend-${key}')" style="cursor: pointer; width: 100%; margin-bottom: 5px;">
                        <span class="code">${key}</span>
                        <span class="description">${getPreview(value)}</span>
                    </div>
                    <div id="content-frontend-${key}" class="json-viewer" style="display: none; width: 100%;">
                        ${formatValue(value)}
                    </div>
                `).join('')}
            </div>
        </div>`;

    element.innerHTML = html;
    element.classList.remove('error');
    _setupToggleFunction();

    // Mostrar primer dato del backend si existe
    const firstBackendKey = data.summary.backend.keys[0];
    if (firstBackendKey) {
        setTimeout(() => window.toggleSection(`backend-${firstBackendKey}`), 100);
    }
}

function getPreview(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') {
        if (value.length > 50) return `${value.substring(0, 47)}...`;
        return value;
    }
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return `${value.length} items`;
        }
        const keys = Object.keys(value);
        if (keys.length === 0) return '{}';
        return `${keys.slice(0, 2).join(', ')}${keys.length > 2 ? ', ...' : ''}`;
    }
    return String(value);
}

function formatValue(value) {
    if (typeof value === 'string' && value.startsWith('QV9+')) {
        return '***** API Key (encriptada) *****';
    }
    return JSON.stringify(value, null, 2);
}

function _setupToggleFunction() {
    if (typeof window.toggleSection === 'function') return;
    
    window.toggleSection = function(key) {
        const content = document.getElementById(`content-${key}`);
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    };
}

function displayError(elementId, error) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('❌ Elemento no encontrado:', elementId);
        return;
    }
    element.innerHTML = `<div class="error">Error: ${error.message || error}</div>`;
    element.classList.add('error');
}

export const storageTest = new StorageTest();
export { displayResult, displayError };