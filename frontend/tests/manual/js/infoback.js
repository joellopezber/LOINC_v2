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
        storageService.wsConfigured = false;
        storageService.autoSync = false;
        storageService.syncQueue = [];
    }

    _saveOriginalFunctions() {
        this.originalSetupWS = storageService._setupWebSocket;
        this.originalQueueSync = storageService.queueSync;
        this.originalInitialize = storageService.initialize;
        this.originalProcessQueue = storageService.processQueue;
    }

    _overrideFunctions() {
        storageService._setupWebSocket = () => {
            console.log('🚫 Configuración WebSocket deshabilitada');
        };

        storageService.queueSync = async (options = {}) => {
            console.log('🔍 Intento de queueSync con opciones:', options);
            if (!options.force) {
                console.log('🚫 Sincronización automática bloqueada');
                return Promise.resolve(false);
            }
            return this.originalQueueSync.call(storageService, options);
        };

        storageService.processQueue = () => {
            console.log('🚫 Procesamiento de cola bloqueado');
            return Promise.resolve(false);
        };

        storageService.initialize = async () => {
            console.log('🔄 Inicializando storage sin WebSocket...');
            storageService.initialized = true;
            storageService.initializing = false;
            return Promise.resolve(true);
        };
    }

    async initialize() {
        try {
            await this._waitForWebSocket();
            if (!this.initialized) {
                await storageService.initialize();
                this.initialized = true;
                console.log('✅ Storage Service initialized (sin sincronización automática)');
            }
        } catch (error) {
            console.error('❌ Error initializing storage:', error);
            throw error;
        }
    }

    async _waitForWebSocket() {
        if (!this.socket?.connected) {
            console.log('⏳ Esperando conexión WebSocket...');
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout esperando WebSocket'));
                }, 5000);
                this.onConnectionChange = (connected) => {
                    if (connected) {
                        clearTimeout(timeout);
                        resolve();
                    }
                };
            });
        }
    }

    async syncWithBackend() {
        try {
            console.log('🔄 Iniciando sincronización manual con backend...');
            const socket = window.socket;
            if (!socket?.connected) {
                throw new Error('No hay conexión WebSocket disponible');
            }

            const data = await this._collectData();
            await this._sendData(socket, data);
            console.log('✅ Sincronización manual completada');
        } catch (error) {
            console.error('❌ Error en sincronización:', error);
            throw error;
        }
    }

    async _collectData() {
        const config = await storageService.get('searchConfig');
        const apiKey = localStorage.getItem('openaiApiKey');
        const timestamp = localStorage.getItem('installTimestamp');
        const ontologyResults = await storageService.get('ontologyResults');

        console.log('📤 Enviando datos al backend:', {
            config: !!config,
            apiKey: !!apiKey,
            timestamp: !!timestamp,
            ontologyResults: !!ontologyResults
        });

        return { config, apiKey, timestamp, ontologyResults };
    }

    async _sendData(socket, data) {
        const { config, apiKey, timestamp, ontologyResults } = data;
        if (config) socket.emit('storage.set_value', { key: 'searchConfig', value: config });
        if (apiKey) socket.emit('storage.set_value', { key: 'openaiApiKey', value: apiKey });
        if (timestamp) socket.emit('storage.set_value', { key: 'installTimestamp', value: timestamp });
        if (ontologyResults) socket.emit('storage.set_value', { key: 'ontologyResults', value: ontologyResults });
    }

    async getAllData() {
        try {
            const localStorageKeys = Object.keys(localStorage);
            
            // Recolectar todos los datos
            const allData = await this._collectAllData([], localStorageKeys);
            
            // Obtener las llaves reales que tienen datos
            const availableKeys = Object.keys(allData);
            const localStorageKeysWithData = localStorageKeys.filter(key => allData[key] !== undefined);

            console.log('🔑 Llaves con datos:', availableKeys);
            console.log('📦 Llaves en localStorage con datos:', localStorageKeysWithData);

            return { 
                availableKeys,
                localStorageKeys: localStorageKeysWithData, 
                data: allData 
            };
        } catch (error) {
            console.error('Error getting data:', error);
            throw error;
        }
    }

    async _collectAllData(availableKeys, localStorageKeys) {
        const allData = {};
        
        // Datos del storageService
        for (const key of availableKeys) {
            try {
                const value = await storageService.get(key);
                if (value !== null) allData[key] = value;
            } catch (error) {
                console.warn(`⚠️ Error obteniendo ${key}:`, error);
            }
        }

        // Datos adicionales de localStorage
        for (const key of localStorageKeys) {
            if (!allData[key]) {
                try {
                    const value = localStorage.getItem(key);
                    if (value !== null) {
                        try {
                            allData[key] = JSON.parse(value);
                        } catch {
                            allData[key] = value;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Error obteniendo ${key} de localStorage:`, error);
                }
            }
        }

        return allData;
    }

    async clearBackendMemory() {
        try {
            console.log('🗑️ Iniciando limpieza de memoria en backend...');
            const socket = window.socket;
            if (!socket?.connected) {
                throw new Error('No hay conexión WebSocket disponible');
            }

            socket.emit('storage.clear');
            console.log('✅ Memoria del backend limpiada');
        } catch (error) {
            console.error('❌ Error limpiando memoria:', error);
            throw error;
        }
    }
}

function displayResult(elementId, data) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Elemento ${elementId} no encontrado`);
        return;
    }

    element.classList.add('results', 'visible');

    const html = `
        <div id="availableKeysSection" class="section">
            <div class="section-title">Llaves Disponibles (${data.availableKeys.length})</div>
            <div class="tag-list">
                ${data.availableKeys.map(key => `<span class="tag">${key}</span>`).join('')}
            </div>
        </div>

        <div id="localStorageSection" class="section">
            <div class="section-title">Llaves en LocalStorage (${data.localStorageKeys.length})</div>
            <div class="tag-list">
                ${data.localStorageKeys.map(key => `<span class="tag">${key}</span>`).join('')}
            </div>
        </div>

        <div id="storedDataSection" class="section">
            <div class="section-title">Datos Almacenados (${Object.keys(data.data).length})</div>
            <div class="tag-list">
                ${Object.entries(data.data).map(([key, value]) => `
                    <div class="loinc-code" onclick="toggleSection('${key}')" style="cursor: pointer; width: 100%; margin-bottom: 5px;">
                        <span class="code">${key}</span>
                        <span class="description">${getPreview(value)}</span>
                    </div>
                    <div id="content-${key}" class="json-viewer" style="display: none; width: 100%;">
                        ${formatValue(value)}
                    </div>
                `).join('')}
            </div>
        </div>`;

    element.innerHTML = html;
    element.classList.remove('error');
    _setupToggleFunction();

    const firstKey = data.data ? Object.keys(data.data)[0] : null;
    if (firstKey) setTimeout(() => window.toggleSection(firstKey), 100);
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
        console.error(`Elemento ${elementId} no encontrado`);
        return;
    }
    element.innerHTML = `<div class="error">Error: ${error.message || error}</div>`;
    element.classList.add('error');
}

export const storageTest = new StorageTest();
export { displayResult, displayError }; 
export { displayResult, displayError }; 