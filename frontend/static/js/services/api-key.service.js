import { encryption } from '../utils/encryption.js';

class ApiKeyService {
    constructor() {
        this.API_ENDPOINTS = {
            openai: 'https://api.openai.com/v1/models',
            anthropic: 'https://api.anthropic.com/v1/messages',
            google: 'https://generativelanguage.googleapis.com/v1/models'
        };
    }

    async testApiKey(provider, apiKey) {
        console.log(`[ApiKey] Probando API key de ${provider}...`);
        
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

            console.log(`[ApiKey] Realizando petición a ${endpoint}...`);
            const response = await fetch(endpoint, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            console.log(`[ApiKey] API key de ${provider} validada correctamente`);
            return {
                success: true,
                message: `API key de ${provider} validada correctamente`
            };

        } catch (error) {
            console.error(`[ApiKey] Error validando API key de ${provider}:`, error);
            return {
                success: false,
                message: `Error validando API key: ${error.message}`
            };
        }
    }

    async saveApiKey(provider, apiKey) {
        try {
            console.log(`[ApiKey] Encriptando API key de ${provider}...`);
            const encryptedKey = await encryption.encrypt(apiKey);
            
            if (!encryptedKey) {
                throw new Error('Error encriptando la API key');
            }

            console.log(`[ApiKey] Guardando API key encriptada de ${provider}...`);
            localStorage.setItem(`${provider}ApiKey`, encryptedKey);
            
            return true;
        } catch (error) {
            console.error(`[ApiKey] Error guardando API key de ${provider}:`, error);
            return false;
        }
    }

    async getApiKey(provider) {
        try {
            console.log(`[ApiKey] Recuperando API key de ${provider}...`);
            const encryptedKey = localStorage.getItem(`${provider}ApiKey`);
            
            if (!encryptedKey) {
                return null;
            }

            console.log(`[ApiKey] Desencriptando API key de ${provider}...`);
            const apiKey = await encryption.decrypt(encryptedKey);
            
            return apiKey;
        } catch (error) {
            console.error(`[ApiKey] Error recuperando API key de ${provider}:`, error);
            return null;
        }
    }
}

export const apiKeyService = new ApiKeyService(); 