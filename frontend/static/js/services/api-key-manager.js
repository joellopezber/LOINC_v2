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
        try {
            console.debug(`[ApiKeyManager] Iniciando proceso de desencriptación para ${provider}...`);
            
            // 1. Verificar si ya tenemos la key desencriptada en caché
            const cachedKey = this.decryptedKeys.get(provider);
            if (cachedKey) {
                console.debug(`[ApiKeyManager] Usando key desencriptada en caché para ${provider}`);
                return cachedKey;
            }

            // 2. Obtener key encriptada
            const encryptedKey = await apiKeyService.getEncryptedKey(provider);
            if (!encryptedKey) {
                console.debug(`[ApiKeyManager] No hay key guardada para ${provider}`);
                return null;
            }

            // 3. Desencriptar key
            console.debug(`[ApiKeyManager] Solicitando desencriptación para ${provider}...`);
            const decryptedKey = await apiKeyService.decryptKey(provider, encryptedKey);
            
            if (!decryptedKey) {
                throw new Error('No se pudo desencriptar la API key');
            }

            // 4. Guardar en caché
            this.decryptedKeys.set(provider, decryptedKey);
            
            console.debug(`[ApiKeyManager] Key desencriptada correctamente para ${provider}`);
            return decryptedKey;

        } catch (error) {
            console.error(`[ApiKeyManager] Error desencriptando key de ${provider}:`, error);
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