import { apiKeyService } from '../services/api-key.service.js';
import { storage } from '../utils/storage.js';

export class ConfigModal {
    constructor() {
        this.modal = document.getElementById('configModal');
        this.sections = {
            search: document.getElementById('searchSection'),
            elastic: document.getElementById('elasticSection'),
            sql: document.getElementById('sqlSection'),
            config: document.getElementById('configSection'),
            apikeys: document.getElementById('apikeysSection')
        };
        
        this.initializeEventListeners();
        this.loadSavedConfig();
        this.loadSavedApiKeys();
        
        // Escuchar eventos globales de apertura/cierre
        document.addEventListener('modal:open', () => this.open());
        document.addEventListener('modal:close', () => this.close());
    }

    open() {
        console.log('[ConfigModal] Abriendo modal...');
        if (this.modal) {
            this.modal.classList.add('visible');
            // Activar la primera sección por defecto
            this.activateSection('search');
        }
    }

    close() {
        console.log('[ConfigModal] Cerrando modal...');
        if (this.modal) {
            this.modal.classList.remove('visible');
            this.saveConfig();
        }
    }

    activateSection(sectionId) {
        console.log(`[ConfigModal] Activando sección: ${sectionId}`);
        // Desactivar todas las secciones
        Object.values(this.sections).forEach(section => {
            if (section) {
                section.classList.remove('active');
            }
        });

        // Activar la sección seleccionada
        const targetSection = this.sections[sectionId];
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Actualizar botones de navegación
        const navButtons = document.querySelectorAll('.nav-item');
        navButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.section === sectionId);
        });
    }

    async initializeEventListeners() {
        // Botones de prueba de API keys
        const testButtons = document.querySelectorAll('.api-key-test');
        testButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const provider = button.dataset.provider;
                const input = document.querySelector(`input[name="${provider}ApiKey"]`);
                await this.testApiKey(provider, input.value);
            });
        });

        // Botón de cierre del modal
        const closeButton = this.modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.close());
        }

        // Click fuera del modal para cerrar
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Navegación entre secciones
        const navButtons = document.querySelectorAll('.nav-item');
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const sectionId = button.dataset.section;
                if (sectionId) {
                    this.activateSection(sectionId);
                }
            });
        });

        // Toggle visibilidad de API keys
        const toggleButtons = document.querySelectorAll('.api-key-toggle');
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const input = button.previousElementSibling;
                const icon = button.querySelector('.material-icons');
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.textContent = 'visibility';
                } else {
                    input.type = 'password';
                    icon.textContent = 'visibility_off';
                }
            });
        });

        // Eventos de configuración
        this.initializeSearchEvents();
        this.initializeElasticEvents();
        this.initializeSqlEvents();
        this.initializeConfigEvents();
    }

    initializeSearchEvents() {
        // Modo de búsqueda
        const searchModeInputs = document.querySelectorAll('input[name="searchMode"]');
        searchModeInputs.forEach(input => {
            input.addEventListener('change', () => {
                const openaiOptions = document.getElementById('openaiOptions');
                if (input.value === 'openai') {
                    openaiOptions.style.display = 'flex';
                } else {
                    openaiOptions.style.display = 'none';
                }
            });
        });

        // Opciones de OpenAI
        const openaiCheckboxes = document.querySelectorAll('#openaiOptions input[type="checkbox"]');
        openaiCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateConfig();
            });
        });
    }

    initializeElasticEvents() {
        // Sliders de Elastic
        const sliders = document.querySelectorAll('#elasticSection input[type="range"]');
        sliders.forEach(slider => {
            const valueContainer = slider.nextElementSibling.querySelector('.value-container');
            slider.addEventListener('input', () => {
                valueContainer.textContent = `${slider.value}%`;
                this.updateConfig();
            });
        });

        // Toggle de opciones avanzadas
        const showAdvancedToggle = document.getElementById('showAdvanced');
        const advancedOptions = document.getElementById('advancedOptions');
        if (showAdvancedToggle && advancedOptions) {
            showAdvancedToggle.addEventListener('change', () => {
                advancedOptions.style.display = showAdvancedToggle.checked ? 'block' : 'none';
                this.updateConfig();
            });
        }

        // Switches de tipos de búsqueda
        ['exact', 'fuzzy', 'smart'].forEach(type => {
            const toggle = document.querySelector(`#${type}Search`);
            const options = document.querySelector(`#${type}Options`);
            if (toggle && options) {
                toggle.addEventListener('change', () => {
                    options.style.display = toggle.checked ? 'flex' : 'none';
                    this.updateConfig();
                });
            }
        });

        // Switches de opciones avanzadas
        ['prefix', 'wildcard'].forEach(type => {
            const toggle = document.querySelector(`#${type}Search`);
            const options = document.querySelector(`#${type}Options`);
            if (toggle && options) {
                toggle.addEventListener('change', () => {
                    options.style.display = toggle.checked ? 'flex' : 'none';
                    this.updateConfig();
                });
            }
        });
    }

    initializeSqlEvents() {
        // Eventos para inputs numéricos de SQL
        const sqlInputs = document.querySelectorAll('#sqlSection input[type="number"]');
        sqlInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateConfig();
            });
        });
    }

    initializeConfigEvents() {
        // Exportar configuración
        const exportButton = document.getElementById('exportConfig');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.exportConfig());
        }

        // Importar configuración
        const importButton = document.getElementById('importConfig');
        if (importButton) {
            importButton.addEventListener('click', () => this.importConfig());
        }

        // Restaurar valores por defecto
        const restoreButton = document.getElementById('restoreDefaults');
        if (restoreButton) {
            restoreButton.addEventListener('click', () => this.restoreDefaults());
        }
    }

    async loadSavedConfig() {
        console.log('[ConfigModal] Cargando configuración guardada...');
        const config = await storage.getConfig();
        
        // Modo de búsqueda
        const searchMode = document.querySelector(`input[name="searchMode"][value="${config.search.ontologyMode}"]`);
        if (searchMode) {
            searchMode.checked = true;
            const openaiOptions = document.getElementById('openaiOptions');
            if (openaiOptions) {
                openaiOptions.style.display = config.search.ontologyMode === 'openai' ? 'flex' : 'none';
            }
        }

        // Opciones de OpenAI
        Object.entries(config.search.openai).forEach(([key, value]) => {
            const checkbox = document.querySelector(`input[name="${key}"]`);
            if (checkbox) {
                checkbox.checked = value;
            }
        });

        // Modo de base de datos
        const dbMode = document.querySelector(`input[name="dbMode"][value="${config.search.dbMode}"]`);
        if (dbMode) {
            dbMode.checked = true;
        }

        // Configuración SQL
        Object.entries(config.sql).forEach(([key, value]) => {
            const input = document.querySelector(`input[name="${key}"]`);
            if (input) {
                input.value = value;
            }
        });

        // Configuración Elastic
        if (config.elastic) {
            // Límites
            Object.entries(config.elastic.limits).forEach(([key, value]) => {
                const input = document.querySelector(`input[name="${key}"]`);
                if (input) {
                    input.value = value;
                }
            });

            // Tipos de búsqueda
            Object.entries(config.elastic.searchTypes).forEach(([type, settings]) => {
                // Toggle del tipo de búsqueda
                const toggle = document.querySelector(`#${type}Search`);
                const options = document.querySelector(`#${type}Options`);
                if (toggle) {
                    toggle.checked = settings.enabled;
                    if (options) {
                        options.style.display = settings.enabled ? 'flex' : 'none';
                    }
                }

                // Configurar sliders
                if (type === 'exact') {
                    const slider = document.querySelector('input[name="exactPriority"]');
                    if (slider) {
                        slider.value = settings.priority;
                        slider.nextElementSibling.querySelector('.value-container').textContent = `${settings.priority}%`;
                    }
                } else if (type === 'fuzzy') {
                    const slider = document.querySelector('input[name="fuzzyTolerance"]');
                    if (slider) {
                        slider.value = settings.tolerance;
                        slider.nextElementSibling.querySelector('.value-container').textContent = `${settings.tolerance}%`;
                    }
                } else if (type === 'smart') {
                    const slider = document.querySelector('input[name="smartPrecision"]');
                    if (slider) {
                        slider.value = settings.precision;
                        slider.nextElementSibling.querySelector('.value-container').textContent = `${settings.precision}%`;
                    }
                }
            });

            // Opciones avanzadas
            const showAdvancedToggle = document.getElementById('showAdvanced');
            const advancedOptions = document.getElementById('advancedOptions');
            if (showAdvancedToggle && advancedOptions) {
                showAdvancedToggle.checked = config.elastic.showAdvanced;
                advancedOptions.style.display = config.elastic.showAdvanced ? 'block' : 'none';

                // Configurar opciones avanzadas si están habilitadas
                if (config.elastic.showAdvanced) {
                    ['prefix', 'wildcard'].forEach(type => {
                        const toggle = document.querySelector(`#${type}Search`);
                        const options = document.querySelector(`#${type}Options`);
                        if (toggle && options) {
                            const enabled = config.elastic[`${type}Enabled`];
                            toggle.checked = enabled;
                            options.style.display = enabled ? 'flex' : 'none';
                        }
                    });
                }
            }
        }
    }

    async loadSavedApiKeys() {
        console.log('[ConfigModal] Cargando API keys guardadas...');
        const providers = ['openai', 'anthropic', 'google'];
        
        for (const provider of providers) {
            const apiKey = await apiKeyService.getApiKey(provider);
            if (apiKey) {
                const input = document.querySelector(`input[name="${provider}ApiKey"]`);
                if (input) {
                    input.value = apiKey;
                    await this.updateApiKeyStatus(provider, true);
                }
            }
        }
    }

    async saveConfig() {
        console.log('[ConfigModal] Guardando configuración...');
        const config = {
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
            }
        };

        await storage.setConfig(config);
    }

    async saveApiKeys() {
        console.log('[ConfigModal] Guardando API keys...');
        const providers = ['openai', 'anthropic', 'google'];
        
        for (const provider of providers) {
            const input = document.querySelector(`input[name="${provider}ApiKey"]`);
            if (input && input.value) {
                await apiKeyService.saveApiKey(provider, input.value);
            }
        }
    }

    async testApiKey(provider, apiKey) {
        if (!apiKey) {
            this.updateApiKeyStatus(provider, false, 'API key no proporcionada');
            return;
        }

        const button = document.querySelector(`button[data-provider="${provider}"].api-key-test`);
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="material-icons rotating">sync</span> Probando...';
        button.disabled = true;

        try {
            const result = await apiKeyService.testApiKey(provider, apiKey);
            this.updateApiKeyStatus(provider, result.success, result.message);
            
            if (result.success) {
                await apiKeyService.saveApiKey(provider, apiKey);
            }
        } finally {
            button.innerHTML = originalText;
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
            text.textContent = 'Configurada y validada';
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

    async exportConfig() {
        const config = await storage.getConfig();
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'loinc-search-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const config = JSON.parse(text);
                    await storage.setConfig(config);
                    await this.loadSavedConfig();
                } catch (error) {
                    console.error('[ConfigModal] Error importando configuración:', error);
                }
            }
        };
        
        input.click();
    }

    async restoreDefaults() {
        if (confirm('¿Estás seguro de que quieres restaurar todos los valores a su configuración por defecto?')) {
            await storage.resetConfig();
            await this.loadSavedConfig();
        }
    }
} 