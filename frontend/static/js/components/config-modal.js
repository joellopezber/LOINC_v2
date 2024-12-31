import { ConfigStorage } from '../../../tests/test/no se/config-storage.js';
import { ApiKeyManager } from '../services/api-key-manager.js';
import { notifications } from '../utils/notifications.js';

export class ConfigModal {
    constructor() {
        this.modal = document.getElementById('configModal');
        this.configStorage = new ConfigStorage();
        this.apiKeyManager = new ApiKeyManager();
        
        this.sections = {
            search: document.getElementById('searchSection'),
            elastic: document.getElementById('elasticSection'),
            sql: document.getElementById('sqlSection'),
            config: document.getElementById('configSection'),
            apikeys: document.getElementById('apikeysSection')
        };
        
        this.initializeEventListeners();
        
        // Eventos globales
        document.addEventListener('modal:open', () => this.open());
        document.addEventListener('modal:close', () => this.close());
    }

    async saveConfig() {
        const saveButton = document.getElementById('saveConfig');
        const originalText = saveButton.innerHTML;

        try {
            saveButton.disabled = true;
            saveButton.innerHTML = '<span class="material-icons rotating">sync</span> Guardando...';
            
            const newConfig = this.getFormConfig();
            const result = await this.configStorage.saveConfig(newConfig);
            
            if (result.success) {
                notifications.success(result.message);
                this.close();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('[ConfigModal] Error al guardar:', error);
            notifications.error(`Error al guardar la configuración: ${error.message}`);
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = originalText;
        }
    }

    getFormConfig() {
        return {
            search: {
                ontologyMode: document.querySelector('input[name="searchMode"]:checked').value,
                dbMode: document.querySelector('input[name="dbMode"]:checked').value,
                openai: {
                    useOriginalTerm: document.querySelector('input[name="useOriginalTerm"]').checked,
                    useEnglishTerm: document.querySelector('input[name="useEnglishTerm"]').checked,
                    useRelatedTerms: document.querySelector('input[name="useRelatedTerms"]').checked,
                    useTestTypes: document.querySelector('input[name="useTestTypes"]').checked,
                    useLoincCodes: document.querySelector('input[name="useLoincCodes"]').checked,
                    useKeywords: document.querySelector('input[name="useKeywords"]').checked
                }
            },
            sql: {
                maxTotal: parseInt(document.querySelector('input[name="sqlMaxTotal"]').value),
                maxPerKeyword: parseInt(document.querySelector('input[name="maxPerKeyword"]').value),
                maxKeywords: parseInt(document.querySelector('input[name="maxKeywords"]').value),
                strictMode: document.querySelector('input[name="sqlMode"][value="strict"]').checked
            },
            elastic: {
                limits: {
                    maxTotal: parseInt(document.querySelector('#elasticSection input[name="maxTotal"]').value),
                    maxPerKeyword: parseInt(document.querySelector('#elasticSection input[name="maxPerKeyword"]').value)
                },
                searchTypes: {
                    exact: {
                        enabled: document.querySelector('input[name="exactEnabled"]').checked,
                        priority: parseInt(document.querySelector('input[name="exactPriority"]').value)
                    },
                    fuzzy: {
                        enabled: document.querySelector('input[name="fuzzyEnabled"]').checked,
                        tolerance: parseInt(document.querySelector('input[name="fuzzyTolerance"]').value)
                    },
                    smart: {
                        enabled: document.querySelector('input[name="smartEnabled"]').checked,
                        precision: parseInt(document.querySelector('input[name="smartPrecision"]').value)
                    }
                },
                showAdvanced: document.getElementById('showAdvanced').checked
            },
            performance: {
                maxCacheSize: parseInt(document.querySelector('input[name="maxCacheSize"]').value),
                cacheExpiry: parseInt(document.querySelector('input[name="cacheExpiry"]').value)
            }
        };
    }

    async open() {
        if (this.modal) {
            this.modal.classList.add('visible');
            await this.loadSavedConfig();
            await this.loadSavedApiKeys();
            this.activateSection('search');
        }
    }

    close() {
        if (this.modal) {
            if (this.configStorage.hasUnsavedChanges || this.apiKeyManager.hasUnsavedApiKeys) {
                const shouldClose = confirm('Hay cambios sin guardar. ¿Deseas cerrar sin guardar?');
                if (!shouldClose) return;
            }
            this.modal.classList.remove('visible');
            this.configStorage.resetChangeTracking();
            this.apiKeyManager.resetChangeTracking();
            this.resetApiKeyInputs(false);
        }
    }

    activateSection(sectionId) {
        Object.values(this.sections).forEach(section => {
            if (section) section.classList.remove('active');
        });

        const targetSection = this.sections[sectionId];
        if (targetSection) targetSection.classList.add('active');

        const navButtons = document.querySelectorAll('.nav-item');
        navButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.section === sectionId);
        });
    }

    initializeEventListeners() {
        // Botones de navegación
        const navButtons = document.querySelectorAll('.nav-item');
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const sectionId = button.dataset.section;
                if (sectionId) {
                    this.activateSection(sectionId);
                }
            });
        });

        // Botones de acción
        this.initializeActionButtons();
        this.initializeApiKeyButtons();
        
        // Eventos de cambio en formulario
        this.initializeFormChangeEvents();
    }

    initializeActionButtons() {
        // Guardar
        const saveButton = document.getElementById('saveConfig');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveConfig());
        }

        // Cancelar
        const cancelButton = document.getElementById('cancelConfig');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => this.close());
        }

        // Cerrar
        const closeButton = this.modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.close());
        }

        // Restaurar valores por defecto
        const restoreButton = document.getElementById('restoreDefaults');
        if (restoreButton) {
            restoreButton.addEventListener('click', async () => {
                if (confirm('¿Estás seguro de que quieres restaurar todos los valores a su configuración por defecto?')) {
                    const result = await this.configStorage.resetConfig();
                    if (result.success) {
                        notifications.success(result.message);
                        await this.loadSavedConfig();
                    } else {
                        notifications.error(result.message);
                    }
                }
            });
        }

        // Click fuera del modal
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    initializeApiKeyButtons() {
        // Botones de test/save/delete
        const testButtons = document.querySelectorAll('.api-key-test');
        testButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const provider = button.dataset.provider;
                const input = document.querySelector(`input[name="${provider}ApiKey"]`);
                
                switch(button.dataset.mode) {
                    case 'delete':
                        await this.deleteApiKey(provider);
                        break;
                    case 'save':
                        await this.saveApiKey(provider, input.value);
                        break;
                    default:
                        await this.testApiKey(provider, input.value);
                }
            });
        });

        // Botones de visualización
        const toggleButtons = document.querySelectorAll('.api-key-toggle');
        toggleButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const input = button.closest('.api-key-input-group').querySelector('.api-key-input');
                const icon = button.querySelector('.material-icons');
                const provider = input.name.replace('ApiKey', '');
                
                if (input.type === 'password') {
                    // Al mostrar, desencriptamos
                    button.disabled = true;
                    icon.textContent = 'sync';
                    icon.classList.add('rotating');
                    
                    try {
                        const decryptedKey = await this.apiKeyManager.decryptApiKey(provider);
                        if (decryptedKey) {
                            input.type = 'text';
                            input.value = decryptedKey;
                            icon.textContent = 'visibility';
                        } else {
                            notifications.error('No se pudo desencriptar la API key');
                        }
                    } catch (error) {
                        notifications.error('Error al desencriptar la API key');
                    } finally {
                        button.disabled = false;
                        icon.classList.remove('rotating');
                    }
                } else {
                    // Al ocultar, volvemos a mostrar la versión encriptada
                    input.type = 'password';
                    input.value = await this.apiKeyManager.getEncryptedKey(provider);
                    icon.textContent = 'visibility_off';
                }
            });
        });
    }

    async loadSavedConfig() {
        const config = await this.configStorage.loadConfig();
        if (config) {
            // Implementar la lógica para actualizar el formulario con la configuración
            this.updateFormWithConfig(config);
        }
    }

    updateFormWithConfig(config) {
        // Modo de búsqueda
        const searchMode = document.querySelector(`input[name="searchMode"][value="${config.search.ontologyMode}"]`);
        if (searchMode) {
            searchMode.checked = true;
            const openaiOptions = document.getElementById('openaiOptions');
            if (openaiOptions) {
                openaiOptions.style.display = config.search.ontologyMode === 'openai' ? 'flex' : 'none';
            }
        }

        // Modo de base de datos
        const dbMode = document.querySelector(`input[name="dbMode"][value="${config.search.dbMode}"]`);
        if (dbMode) {
            dbMode.checked = true;
        }

        // Opciones de OpenAI
        Object.entries(config.search.openai).forEach(([key, value]) => {
            const checkbox = document.querySelector(`input[name="${key}"]`);
            if (checkbox) {
                checkbox.checked = value;
            }
        });

        // Configuración SQL
        const sqlInputs = {
            sqlMaxTotal: config.sql.maxTotal,
            maxPerKeyword: config.sql.maxPerKeyword,
            maxKeywords: config.sql.maxKeywords
        };

        Object.entries(sqlInputs).forEach(([key, value]) => {
            const input = document.querySelector(`input[name="${key}"]`);
            if (input) {
                input.value = value;
            }
        });

        // Modo SQL
        const sqlMode = document.querySelector('input[name="sqlMode"][value="strict"]');
        if (sqlMode) {
            sqlMode.checked = config.sql.strictMode;
        }

        // Configuración Elastic
        if (config.elastic) {
            // Límites
            Object.entries(config.elastic.limits).forEach(([key, value]) => {
                const input = document.querySelector(`#elasticSection input[name="${key}"]`);
                if (input) {
                    input.value = value;
                }
            });

            // Tipos de búsqueda
            Object.entries(config.elastic.searchTypes).forEach(([type, settings]) => {
                const toggle = document.querySelector(`input[name="${type}Enabled"]`);
                const options = document.querySelector(`#${type}Options`);
                
                if (toggle) {
                    toggle.checked = settings.enabled;
                    if (options) {
                        options.style.display = settings.enabled ? 'flex' : 'none';
                    }
                }

                // Configuración específica por tipo
                if (type === 'exact') {
                    const priority = document.querySelector('input[name="exactPriority"]');
                    if (priority) {
                        priority.value = settings.priority;
                    }
                } else if (type === 'fuzzy') {
                    const tolerance = document.querySelector('input[name="fuzzyTolerance"]');
                    if (tolerance) {
                        tolerance.value = settings.tolerance;
                    }
                } else if (type === 'smart') {
                    const precision = document.querySelector('input[name="smartPrecision"]');
                    if (precision) {
                        precision.value = settings.precision;
                    }
                }
            });

            // Opciones avanzadas
            const showAdvanced = document.getElementById('showAdvanced');
            const advancedOptions = document.getElementById('advancedOptions');
            if (showAdvanced && advancedOptions) {
                showAdvanced.checked = config.elastic.showAdvanced;
                advancedOptions.style.display = config.elastic.showAdvanced ? 'block' : 'none';
            }
        }

        // Configuración de Performance
        if (config.performance) {
            const maxCacheSize = document.querySelector('input[name="maxCacheSize"]');
            const cacheExpiry = document.querySelector('input[name="cacheExpiry"]');

            if (maxCacheSize) maxCacheSize.value = config.performance.maxCacheSize;
            if (cacheExpiry) cacheExpiry.value = config.performance.cacheExpiry;
        }
    }

    async loadSavedApiKeys() {
        const apiKeys = await this.apiKeyManager.loadApiKeys();
        
        for (const [provider, data] of Object.entries(apiKeys)) {
            const input = document.querySelector(`input[name="${provider}ApiKey"]`);
            const button = document.querySelector(`button[data-provider="${provider}"].api-key-test`);
            
            if (data.hasKey) {
                if (input) {
                    input.value = data.value;
                    await this.updateApiKeyStatus(provider, true);
                }
                if (button) {
                    button.innerHTML = '<span class="material-icons">delete</span> Borrar';
                    button.dataset.mode = 'delete';
                    button.classList.add('delete-mode');
                }
            } else {
                if (button) {
                    button.innerHTML = '<span class="material-icons">check_circle</span> Probar';
                    button.dataset.mode = 'test';
                    button.classList.remove('save-mode', 'delete-mode');
                }
                if (input) {
                    input.value = '';
                }
            }
        }
    }

    async deleteApiKey(provider) {
        const button = document.querySelector(`button[data-provider="${provider}"].api-key-test`);
        const input = document.querySelector(`input[name="${provider}ApiKey"]`);
        
        try {
            button.disabled = true;
            button.innerHTML = '<span class="material-icons rotating">sync</span> Borrando...';
            
            const result = await this.apiKeyManager.deleteApiKey(provider);
            if (result.success) {
                input.value = '';
                this.updateApiKeyStatus(provider, false, 'No configurada');
                button.innerHTML = '<span class="material-icons">check_circle</span> Probar';
                button.dataset.mode = 'test';
                button.classList.remove('delete-mode');
                notifications.success('API key eliminada correctamente');
            } else {
                notifications.error(result.message);
            }
        } catch (error) {
            notifications.error('Error al eliminar la API key');
        } finally {
            button.disabled = false;
        }
    }

    async saveApiKey(provider, apiKey) {
        const button = document.querySelector(`button[data-provider="${provider}"].api-key-test`);
        
        try {
            button.disabled = true;
            button.innerHTML = '<span class="material-icons rotating">sync</span> Guardando...';
            
            const result = await this.apiKeyManager.saveApiKey(provider, apiKey);
            if (result.success) {
                this.updateApiKeyStatus(provider, true, 'Configurada y validada');
                button.innerHTML = '<span class="material-icons">delete</span> Borrar';
                button.dataset.mode = 'delete';
                button.classList.remove('save-mode');
                button.classList.add('delete-mode');
                notifications.success(result.message);
            } else {
                notifications.error(result.message);
                button.innerHTML = '<span class="material-icons">check_circle</span> Probar';
                button.dataset.mode = 'test';
                button.classList.remove('save-mode', 'delete-mode');
            }
        } catch (error) {
            notifications.error('Error al guardar la API key');
            button.innerHTML = '<span class="material-icons">check_circle</span> Probar';
            button.dataset.mode = 'test';
            button.classList.remove('save-mode', 'delete-mode');
        } finally {
            button.disabled = false;
        }
    }

    async testApiKey(provider, apiKey) {
        const button = document.querySelector(`button[data-provider="${provider}"].api-key-test`);
        
        try {
            button.disabled = true;
            button.innerHTML = '<span class="material-icons rotating">sync</span> Probando...';
            
            const result = await this.apiKeyManager.testApiKey(provider, apiKey);
            this.updateApiKeyStatus(provider, result.success, result.message);
            
            if (result.success) {
                button.innerHTML = '<span class="material-icons">save</span> Guardar';
                button.dataset.mode = 'save';
                button.classList.add('save-mode');
            } else {
                button.innerHTML = '<span class="material-icons">check_circle</span> Probar';
                button.dataset.mode = 'test';
                button.classList.remove('save-mode');
            }
        } catch (error) {
            this.updateApiKeyStatus(provider, false, 'Error al probar la API key');
            button.innerHTML = '<span class="material-icons">check_circle</span> Probar';
            button.dataset.mode = 'test';
            button.classList.remove('save-mode');
        } finally {
            button.disabled = false;
        }
    }

    updateApiKeyStatus(provider, isValid, message = '') {
        const statusContainer = document.querySelector(`input[name="${provider}ApiKey"]`).closest('.api-key-item').querySelector('.api-key-status');
        const dot = statusContainer.querySelector('.status-dot');
        const text = statusContainer.querySelector('.status-text');

        if (isValid) {
            dot.classList.remove('not-configured', 'error');
            dot.classList.add('configured');
            text.textContent = message || 'Configurada y validada';
            text.classList.remove('error-text');
        } else {
            dot.classList.remove('configured');
            dot.classList.add('not-configured');
            if (message) {
                text.textContent = message;
                dot.classList.add('error');
                text.classList.add('error-text');
            } else {
                text.textContent = 'No configurada';
                dot.classList.remove('error');
                text.classList.remove('error-text');
            }
        }
    }

    resetApiKeyInputs(shouldReload = true) {
        this.apiKeyManager.providers.forEach(provider => {
            const input = document.querySelector(`input[name="${provider}ApiKey"]`);
            const button = document.querySelector(`button[data-provider="${provider}"].api-key-test`);
            if (input && button) {
                input.value = '';
                button.innerHTML = '<span class="material-icons">check_circle</span> Probar';
                button.classList.remove('save-mode');
                button.disabled = false;
                this.updateApiKeyStatus(provider, false);
            }
        });
        
        if (shouldReload) {
            this.loadSavedApiKeys();
        }
    }

    initializeFormChangeEvents() {
        // Modo de búsqueda
        const searchModeInputs = document.querySelectorAll('input[name="searchMode"]');
        searchModeInputs.forEach(input => {
            input.addEventListener('change', () => {
                const openaiOptions = document.getElementById('openaiOptions');
                if (openaiOptions) {
                    openaiOptions.style.display = input.value === 'openai' ? 'flex' : 'none';
                }
                this.configStorage.markAsChanged();
            });
        });

        // Opciones de OpenAI
        const openaiCheckboxes = document.querySelectorAll('#openaiOptions input[type="checkbox"]');
        openaiCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.configStorage.markAsChanged());
        });

        // Inputs numéricos
        const numericInputs = document.querySelectorAll('input[type="number"]');
        numericInputs.forEach(input => {
            input.addEventListener('change', () => this.configStorage.markAsChanged());
        });

        // Checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.configStorage.markAsChanged());
        });

        // Radio buttons
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => this.configStorage.markAsChanged());
        });

        // Sliders
        const sliders = document.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            slider.addEventListener('input', () => {
                const valueContainer = slider.nextElementSibling?.querySelector('.value-container');
                if (valueContainer) {
                    valueContainer.textContent = `${slider.value}%`;
                }
                this.configStorage.markAsChanged();
            });
        });
    }
} 