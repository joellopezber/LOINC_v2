import { storage } from '../../../static/js/utils/storage.js';
import { notifications } from '../../../static/js/utils/notifications.js';
import { DEFAULT_CONFIG } from '../../../static/js/config/default-config.js';

export class ConfigStorage {
    constructor() {
        this.hasUnsavedChanges = false;
    }

    async saveConfig(newConfig) {
        try {
            if (!this.validateConfig(newConfig)) {
                throw new Error('Configuración inválida');
            }

            const currentConfig = await storage.getConfig();
            const hasChanges = JSON.stringify(currentConfig) !== JSON.stringify(newConfig);
            
            if (hasChanges) {
                const result = await storage.setConfig(newConfig);
                if (result.status === 'error') {
                    throw new Error(result.message || 'Error al guardar la configuración');
                }
                this.hasUnsavedChanges = false;
                return { success: true, message: 'Configuración guardada correctamente' };
            }
            
            return { success: true, message: 'No hay cambios que guardar' };
        } catch (error) {
            console.error('[ConfigStorage] Error al guardar:', error);
            return { success: false, message: error.message };
        }
    }

    validateConfig(config) {
        // Validar valores numéricos de SQL
        if (config.sql.maxTotal <= 0 || config.sql.maxPerKeyword <= 0 || config.sql.maxKeywords <= 0) {
            notifications.error('Los valores numéricos deben ser mayores a 0');
            return false;
        }

        // Validar límites de Elastic
        if (config.elastic.limits.maxTotal <= 0 || config.elastic.limits.maxPerKeyword <= 0) {
            notifications.error('Los límites de Elastic deben ser mayores a 0');
            return false;
        }

        // Validar tipos de búsqueda
        for (const [type, settings] of Object.entries(config.elastic.searchTypes)) {
            if (settings.enabled) {
                if (type === 'exact' && (settings.priority < 1 || settings.priority > 100)) {
                    notifications.error('La prioridad debe estar entre 1 y 100');
                    return false;
                }
                if (type === 'fuzzy' && (settings.tolerance < 1 || settings.tolerance > 5)) {
                    notifications.error('La tolerancia debe estar entre 1 y 5');
                    return false;
                }
                if (type === 'smart' && (settings.precision < 1 || settings.precision > 10)) {
                    notifications.error('La precisión debe estar entre 1 y 10');
                    return false;
                }
            }
        }

        return true;
    }

    async loadConfig() {
        try {
            const config = await storage.getConfig();
            return config || this.getDefaultConfig();
        } catch (error) {
            console.error('[ConfigStorage] Error al cargar configuración:', error);
            notifications.error('Error al cargar la configuración');
            return this.getDefaultConfig();
        }
    }

    async resetConfig() {
        try {
            const defaultConfig = this.getDefaultConfig();
            await storage.setConfig(defaultConfig);
            this.hasUnsavedChanges = false;
            return { success: true, message: 'Configuración restaurada correctamente' };
        } catch (error) {
            console.error('[ConfigStorage] Error al restaurar configuración:', error);
            return { success: false, message: error.message };
        }
    }

    getDefaultConfig() {
        return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone para evitar modificaciones accidentales
    }

    markAsChanged() {
        this.hasUnsavedChanges = true;
    }

    resetChangeTracking() {
        this.hasUnsavedChanges = false;
    }
} 