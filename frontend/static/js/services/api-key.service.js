import { encryption } from '../utils/encryption.js';
import { storageService } from './storage.service.js';
import { websocketService } from './websocket.service.js';
import { notifications } from '../utils/notifications.js';

class ApiKeyService {
    constructor() {
        this.API_ENDPOINTS = {
            openai: 'https://api.openai.com/v1/models',
            anthropic: 'https://api.anthropic.com/v1/messages',
            google: 'https://generativelanguage.googleapis.com/v1/models'
        };
        
        // Caché de API keys y estados
        this.keyCache = new Map();
        this.cacheTimeout = 5000; // 5 segundos
        this.hasKeyCache = new Map();
        this.masterKeyPromise = null;
    }

    async getEncryptedKey(provider) {
        try {
            return localStorage.getItem(`${provider}ApiKey`);
        } catch (error) {
            console.error(`[ApiKey] Error cargando ${provider}:`, error);
            return null;
        }
    }

    async getMasterKey() {
        try {
            if (this.masterKeyPromise) {
                return await this.masterKeyPromise;
            }

            const install_id = localStorage.getItem('installTimestamp');
            if (!install_id) {
                throw new Error('No se encontró install_id');
            }
            
            this.masterKeyPromise = new Promise(async (resolve, reject) => {
                try {
                    const response = await websocketService.sendRequest('encryption.get_master_key', {
                        installTimestamp: install_id
                    });

                    if (!response || response.status === 'error') {
                        throw new Error(response?.message || 'Error obteniendo master key');
                    }

                    resolve(response.key);
                } catch (error) {
                    console.error('[ApiKey] Error en master key:', error);
                    reject(error);
                }
            });

            const masterKey = await this.masterKeyPromise;
            this.masterKeyPromise = null;
            return masterKey;

        } catch (error) {
            this.masterKeyPromise = null;
            console.error('[ApiKey] Error en master key:', error);
            throw error;
        }
    }

    async decryptKey(provider, encryptedKey) {
        try {
            return await encryption.decrypt(encryptedKey);
        } catch (error) {
            console.error(`[ApiKey] Error desencriptando ${provider}:`, error);
            return null;
        }
    }

    async _getCachedKey(provider) {
        const cached = this.keyCache.get(provider);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.value;
        }
        return null;
    }

    async _getCachedHasKey(provider) {
        const cached = this.hasKeyCache.get(provider);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.value;
        }
        return null;
    }

    async _setCachedKey(provider, value) {
        this.keyCache.set(provider, {
            value,
            timestamp: Date.now()
        });
        // También actualizar el caché de hasKey
        this.hasKeyCache.set(provider, {
            value: value !== null,
            timestamp: Date.now()
        });
    }

    async _clearCache(provider) {
        this.keyCache.delete(provider);
        this.hasKeyCache.delete(provider);
    }

    async testApiKey(provider, apiKey) {
        try {
            const endpoint = this.API_ENDPOINTS[provider];
            if (!endpoint) {
                throw new Error(`Proveedor no soportado: ${provider}`);
            }

            const headers = {
                'Content-Type': 'application/json'
            };

            switch(provider) {
                case 'openai':
                    headers['Authorization'] = `Bearer ${apiKey}`;
                    break;
                case 'anthropic':
                    headers['x-api-key'] = apiKey;
                    break;
                case 'google':
                    headers['Authorization'] = `Bearer ${apiKey}`;
                    break;
            }

            const response = await fetch(endpoint, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            return {
                success: true,
                message: `API key de ${provider} validada correctamente`
            };

        } catch (error) {
            console.error(`[ApiKey] Error validando ${provider}:`, error);
            return {
                success: false,
                message: `Error validando API key: ${error.message}`
            };
        }
    }

    async saveApiKey(provider, apiKey) {
        try {
            const encryptedKey = await encryption.encrypt(apiKey);
            localStorage.setItem(`${provider}ApiKey`, encryptedKey);
            notifications.success(`API key de ${provider} guardada correctamente`);
            return { success: true };
        } catch (error) {
            console.error(`[ApiKey] Error guardando ${provider}:`, error);
            notifications.error(`Error al guardar API key de ${provider}`);
            return { success: false, message: error.message };
        }
    }

    async deleteApiKey(provider) {
        try {
            localStorage.removeItem(`${provider}ApiKey`);
            await this._clearCache(provider);
            return {
                success: true,
                message: `API key de ${provider} eliminada correctamente`
            };
        } catch (error) {
            console.error(`[ApiKey] Error eliminando ${provider}:`, error);
            return {
                success: false,
                message: `Error eliminando API key: ${error.message}`
            };
        }
    }

    async getApiKey(provider) {
        try {
            // Intentar obtener del caché primero
            const cached = await this._getCachedKey(provider);
            if (cached !== null) {
                console.debug(`[ApiKey] ${provider}: usando caché`);
                return cached;
            }

            console.debug(`[ApiKey] ${provider}: recuperando...`);
            const encryptedKey = localStorage.getItem(`${provider}ApiKey`);
            
            if (!encryptedKey) {
                console.debug(`[ApiKey] ${provider}: no encontrada`);
                return null;
            }

            console.debug(`[ApiKey] ${provider}: desencriptando...`);
            const apiKey = await encryption.decrypt(encryptedKey);
            
            // Guardar en caché
            await this._setCachedKey(provider, apiKey);
            console.debug(`[ApiKey] ${provider}: guardada en caché`);
            
            return apiKey;
        } catch (error) {
            console.error(`[ApiKey] Error con ${provider}:`, error);
            return null;
        }
    }

    async hasApiKey(provider) {
        try {
            // Intentar obtener del caché primero
            const cachedHasKey = await this._getCachedHasKey(provider);
            if (cachedHasKey !== null) {
                console.debug(`[ApiKey] ${provider}: estado en caché = ${cachedHasKey}`);
                return cachedHasKey;
            }

            // Si no está en caché, verificar si existe en localStorage
            const encryptedKey = localStorage.getItem(`${provider}ApiKey`);
            const hasKey = encryptedKey !== null;
            
            // Actualizar caché
            this.hasKeyCache.set(provider, {
                value: hasKey,
                timestamp: Date.now()
            });
            
            console.debug(`[ApiKey] ${provider}: estado = ${hasKey}`);
            return hasKey;
        } catch (error) {
            console.error(`[ApiKey] Error verificando ${provider}:`, error);
            return false;
        }
    }
}

export const apiKeyService = new ApiKeyService(); 