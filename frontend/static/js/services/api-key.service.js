import { encryption } from '../utils/encryption.js';

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
        console.log(`[ApiKey] ${provider}: probando...`);
        
        try {
            const endpoint = this.API_ENDPOINTS[provider];
            if (!endpoint) {
                throw new Error(`Proveedor no soportado: ${provider}`);
            }

            const headers = {
                'Content-Type': 'application/json'
            };

            // Configurar headers específicos por proveedor
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

            console.log(`[ApiKey] ${provider}: conectando a ${endpoint}...`);
            const response = await fetch(endpoint, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            console.log(`[ApiKey] ${provider}: validada correctamente`);
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
            console.log(`[ApiKey] ${provider}: encriptando...`);
            const encryptedKey = await encryption.encrypt(apiKey);
            
            if (!encryptedKey) {
                throw new Error('Error encriptando la API key');
            }

            console.log(`[ApiKey] ${provider}: guardando...`);
            localStorage.setItem(`${provider}ApiKey`, encryptedKey);
            
            // Limpiar caché al guardar nueva key
            await this._clearCache(provider);
            console.debug(`[ApiKey] ${provider}: caché limpiado`);
            
            return {
                success: true,
                message: `API key de ${provider} guardada correctamente`
            };
        } catch (error) {
            console.error(`[ApiKey] Error guardando ${provider}:`, error);
            return {
                success: false,
                message: `Error guardando API key: ${error.message}`
            };
        }
    }

    async deleteApiKey(provider) {
        try {
            console.log(`[ApiKey] ${provider}: eliminando...`);
            localStorage.removeItem(`${provider}ApiKey`);
            
            // Limpiar caché al eliminar key
            await this._clearCache(provider);
            console.debug(`[ApiKey] ${provider}: caché limpiado`);
            
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