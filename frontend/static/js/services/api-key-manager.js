import { apiKeyService } from './api-key.service.js';
import { notifications } from '../utils/notifications.js';

export class ApiKeyManager {
    constructor() {
        this.hasUnsavedApiKeys = false;
        this.providers = ['openai', 'anthropic', 'google'];
    }

    async saveApiKey(provider, apiKey) {
        try {
            const result = await apiKeyService.saveApiKey(provider, apiKey);
            if (result.success) {
                this.hasUnsavedApiKeys = false;
            }
            return result;
        } catch (error) {
            console.error('[ApiKeyManager] Error al guardar API key:', error);
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
                console.error(`[ApiKeyManager] Error al cargar API key de ${provider}:`, error);
                notifications.error(`Error al cargar API key de ${provider}`);
            }
        }
        
        return apiKeys;
    }

    async decryptApiKey(provider) {
        const encryptedKey = await apiKeyService.getEncryptedKey(provider);
        if (!encryptedKey) return null;
        
        return await apiKeyService.decryptKey(provider, encryptedKey);
    }

    markAsChanged() {
        this.hasUnsavedApiKeys = true;
    }

    resetChangeTracking() {
        this.hasUnsavedApiKeys = false;
    }
} 