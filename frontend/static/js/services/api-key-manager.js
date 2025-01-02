import { apiKeyService } from './api-key.service.js';
import { notifications } from '../utils/notifications.js';

export class ApiKeyManager {
    constructor() {
        this.providers = ['openai', 'anthropic', 'google'];
        this.hasUnsavedApiKeys = false;
        this.apiKeys = {};
        this.decryptedKeys = new Map();
    }

    async saveApiKey(provider, apiKey) {
        try {
            const result = await apiKeyService.saveApiKey(provider, apiKey);
            if (result.success) {
                this.hasUnsavedApiKeys = false;
            }
            return result;
        } catch (error) {
            console.error(`[ApiKey] Error guardando ${provider}:`, error);
            return { success: false, message: error.message };
        }
    }

    async testApiKey(provider, apiKey) {
        if (!apiKey) {
            return { success: false, message: 'API key no proporcionada' };
        }

        try {
            return await apiKeyService.testApiKey(provider, apiKey);
        } catch (error) {
            console.error('[ApiKeyManager] Error al probar API key:', error);
            return { success: false, message: error.message };
        }
    }

    async deleteApiKey(provider) {
        try {
            return await apiKeyService.deleteApiKey(provider);
        } catch (error) {
            console.error('[ApiKeyManager] Error al eliminar API key:', error);
            return { success: false, message: error.message };
        }
    }

    async loadApiKeys() {
        const apiKeys = {};
        
        for (const provider of this.providers) {
            try {
                const encryptedKey = await apiKeyService.getEncryptedKey(provider);
                apiKeys[provider] = {
                    hasKey: encryptedKey !== null,
                    value: encryptedKey,
                    decrypted: false
                };
            } catch (error) {
                console.error(`[ApiKey] Error cargando ${provider}:`, error);
                notifications.error(`Error al cargar API key de ${provider}`);
            }
        }
        
        return apiKeys;
    }

    async decryptApiKey(provider) {
        try {
            const cachedKey = this.decryptedKeys.get(provider);
            if (cachedKey) {
                return cachedKey;
            }

            const encryptedKey = await apiKeyService.getEncryptedKey(provider);
            if (!encryptedKey) {
                return null;
            }

            const decryptedKey = await apiKeyService.decryptKey(provider, encryptedKey);
            
            if (!decryptedKey) {
                throw new Error('No se pudo desencriptar la API key');
            }

            this.decryptedKeys.set(provider, decryptedKey);
            return decryptedKey;

        } catch (error) {
            console.error(`[ApiKey] Error desencriptando ${provider}:`, error);
            notifications.error(`Error desencriptando API key de ${provider}`);
            return null;
        }
    }

    markAsChanged() {
        this.hasUnsavedApiKeys = true;
        // Limpiar caché de keys desencriptadas
        this.decryptedKeys.clear();
    }

    resetChangeTracking() {
        this.hasUnsavedApiKeys = false;
    }
} 