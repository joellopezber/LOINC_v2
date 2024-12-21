import { notifications } from '../utils/notifications.js';

// Config Modal Component
class ConfigModal {
    constructor() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            // Esperar un momento para asegurar que storage esté disponible
            setTimeout(() => this.init(), 0);
        }

        // Agregar listener para abrir el modal
        document.addEventListener('modal:open', () => {
            console.log('Evento modal:open recibido');
            this.show();
        });
    }

    init() {
        if (!window.storage) {
            console.warn('[ConfigModal] Storage no disponible, reintentando...');
            setTimeout(() => this.init(), 100);
            return;
        }

        if (!this.initializeReferences()) {
            console.error('[ConfigModal] Error: No se pudieron inicializar las referencias');
            return;
        }
        
        this.initializeConfigButton();
        this.initializeEventListeners();
        this.initializeElasticSection();
        this.loadConfig();

        console.info('[ConfigModal] Inicializado correctamente');
    }

    initializeConfigButton() {
        const configButton = document.querySelector('.config-button');
        if (configButton) {
            configButton.addEventListener('click', () => {
                this.show();
            });
        } else {
            console.error('No se encontró el botón de configuración');
        }
    }

    initializeReferences() {
        // Modal elements
        this.modal = document.getElementById('configModal');
        this.closeButton = document.getElementById('closeConfigModal');
        this.cancelButton = document.getElementById('cancelConfig');
        this.saveButton = document.getElementById('saveConfig');
        this.deleteOntologyButton = document.getElementById('deleteOntology');
        this.restoreDefaultsButton = document.getElementById('restoreDefaults');
        
        // Navigation
        this.navItems = document.querySelectorAll('.nav-item');
        
        // Sections
        this.sections = {
            search: document.getElementById('searchSection'),
            elastic: document.getElementById('elasticSection'),
            sql: document.getElementById('sqlSection'),
            config: document.getElementById('configSection')
        };
        
        // Search options
        this.searchModeRadios = document.querySelectorAll('input[name="searchMode"]');
        this.dbModeRadios = document.querySelectorAll('input[name="dbMode"]');
        this.openaiOptions = document.getElementById('openaiOptions');

        // Verificar elementos críticos
        if (!this.modal || !this.sections.search) {
            console.error('Elementos críticos del modal no encontrados');
            return false;
        }

        return true;
    }

    initializeEventListeners() {
        // Modal controls
        this.closeButton?.addEventListener('click', () => this.hide());
        this.cancelButton?.addEventListener('click', () => this.hide());
        this.saveButton?.addEventListener('click', () => this.saveAndClose());

        // Navigation
        document.querySelector('.modal-nav')?.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                const section = navItem.dataset.section;
                if (section) {
                    this.switchSection(section);
                }
            }
        });

        // Header controls
        document.querySelectorAll('.header-controls input[type="number"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const slider = e.target.closest('.option-group').querySelector('input[type="range"]');
                if (slider) {
                    slider.value = e.target.value;
                    this.updateSliderValue(slider);
                }
            });
        });

        // Sliders
        document.querySelectorAll('.slider-control input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => this.updateSliderValue(e.target));
        });

        // Checkboxes en header
        document.querySelectorAll('.header-controls input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const controls = e.target.closest('.option-group').querySelector('.param-controls');
                if (controls) {
                    controls.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        });

        // Actualizar valores de los deslizadores
        document.querySelectorAll('.slider-control input[type="range"]').forEach(slider => {
            const valueContainer = slider.nextElementSibling;
            slider.addEventListener('input', () => {
                valueContainer.textContent = `${slider.value}%`;
            });
        });

        // Toggle configuración avanzada
        const showAdvancedCheckbox = document.getElementById('showAdvanced');
        const advancedOptions = document.getElementById('advancedOptions');
        if (showAdvancedCheckbox && advancedOptions) {
            showAdvancedCheckbox.addEventListener('change', () => {
                advancedOptions.style.display = showAdvancedCheckbox.checked ? 'block' : 'none';
            });
        }

        // Search mode change
        this.searchModeRadios?.forEach(radio => {
            radio.addEventListener('change', () => {
                this.toggleOpenAIOptions();
                // Disparar evento de cambio de modo
                window.dispatchEvent(new CustomEvent('searchModeChanged', {
                    detail: { mode: radio.value }
                }));
            });
        });

        // Data management
        this.deleteOntologyButton?.addEventListener('click', async () => {
            if (confirm('¿Estás seguro de que deseas eliminar todos los datos de ontología? Esta acción no se puede deshacer.')) {
                try {
                    await this.deleteOntology();
                    alert('Ontología eliminada correctamente');
                } catch (error) {
                    alert('Error al eliminar la ontología');
                }
            }
        });

        this.restoreDefaultsButton?.addEventListener('click', () => {
            this.restoreDefaults();
        });

        // Close on outside click or escape key
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal?.classList.contains('visible')) {
                this.hide();
            }
        });

        // Input validation
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', () => {
                const value = parseInt(input.value);
                const min = parseInt(input.min);
                const max = parseInt(input.max);

                if (value < min) input.value = min;
                if (value > max) input.value = max;
            });
        });

        // API Key visibility toggles
        document.querySelectorAll('.toggle-visibility').forEach(button => {
            button.addEventListener('click', (e) => {
                const input = e.target.closest('.key-input').querySelector('input');
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

        // API Key test buttons
        document.querySelectorAll('.test-key').forEach(button => {
            button.addEventListener('click', async () => {
                const provider = button.dataset.provider;
                const input = button.closest('.api-key-group').querySelector('input');
                const statusContainer = button.closest('.api-key-group').querySelector('.key-status');
                const statusIndicator = statusContainer.querySelector('.status-indicator');
                const statusText = statusContainer.querySelector('.status-text');

                if (!input.value) {
                    this.updateKeyStatus(statusIndicator, statusText, 'error', 'API Key no configurada');
                    return;
                }

                try {
                    statusIndicator.className = 'status-indicator loading';
                    statusText.textContent = 'Probando conexión...';
                    
                    const result = await this.testApiKey(provider, input.value);
                    
                    if (result.success) {
                        this.updateKeyStatus(statusIndicator, statusText, 'success', 'Conexión exitosa');
                    } else {
                        this.updateKeyStatus(statusIndicator, statusText, 'error', result.message || 'Error de conexión');
                    }
                } catch (error) {
                    this.updateKeyStatus(statusIndicator, statusText, 'error', 'Error de conexión');
                }
            });
        });

        // SQL Search Limit Radio Buttons
        const sqlSearchLimitRadios = document.querySelectorAll('input[name="sqlSearchLimit"]');
        const sqlMaxTotalInput = document.querySelector('input[name="sqlMaxTotal"]');
        
        sqlSearchLimitRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (sqlMaxTotalInput) {
                    sqlMaxTotalInput.disabled = e.target.value === 'default';
                }
            });
        });

        // Elastic Search Type Checkboxes
        const elasticSearchTypes = ['exact', 'fuzzy', 'smart'];
        elasticSearchTypes.forEach(type => {
            const checkbox = document.querySelector(`#${type}Enabled`);
            const controls = checkbox?.closest('.radio-option').querySelector('.param-controls');
            
            if (checkbox && controls) {
                checkbox.addEventListener('change', (e) => {
                    controls.style.display = e.target.checked ? 'block' : 'none';
                });
            }
        });
    }

    updateSliderValue(slider) {
        const valueContainer = slider.closest('.slider-control').querySelector('.value-container');
        if (valueContainer) {
            valueContainer.textContent = `${slider.value}%`;
        }
    }

    show() {
        if (this.modal) {
            this.modal.classList.add('visible');
            // Cargar configuración actual
            this.loadConfig();
        }
    }

    hide() {
        if (this.modal) {
            this.modal.classList.remove('visible');
        }
    }

    switchSection(sectionId) {
        if (!this.navItems || !this.sections) return;

        // Remover clase active de todas las secciones y nav items
        Object.values(this.sections).forEach(section => {
            if (section) {
                section.classList.remove('active');
                section.style.display = 'none';
            }
        });

        this.navItems.forEach(item => {
            item.classList.remove('active');
            item.setAttribute('aria-selected', 'false');
        });

        // Activar la sección seleccionada
        const selectedSection = this.sections[sectionId];
        const selectedNavItem = Array.from(this.navItems).find(item => item.dataset.section === sectionId);

        if (selectedSection) {
            selectedSection.classList.add('active');
            selectedSection.style.display = 'block';
        }

        if (selectedNavItem) {
            selectedNavItem.classList.add('active');
            selectedNavItem.setAttribute('aria-selected', 'true');
        }

        // Actualizar OpenAI options si estamos en la sección de búsqueda
        if (sectionId === 'search') {
            this.toggleOpenAIOptions();
        }
    }

    toggleOpenAIOptions() {
        const openaiRadio = document.querySelector('input[name="searchMode"][value="openai"]');
        const openaiOptions = document.getElementById('openaiOptions');
        
        if (openaiOptions) {
            if (openaiRadio?.checked) {
                openaiOptions.style.display = 'flex';
                openaiOptions.style.opacity = '1';
            } else {
                openaiOptions.style.display = 'none';
                openaiOptions.style.opacity = '0';
            }
        }
    }

    async loadConfig() {
        try {
            const config = await window.storage.getConfig();
            if (!config) return;

            // Cargar modo de búsqueda
            if (config.search?.ontologyMode) {
                const radio = Array.from(this.searchModeRadios)
                    .find(r => r.value === config.search.ontologyMode);
                if (radio) {
                    radio.checked = true;
                    this.toggleOpenAIOptions();
                }
            }

            // Cargar modo de base de datos
            if (config.search?.dbMode) {
                const radio = Array.from(this.dbModeRadios)
                    .find(r => r.value === config.search.dbMode);
                if (radio) {
                    radio.checked = true;
                }
            }

            // Cargar opciones de OpenAI
            if (config.search?.openai) {
                const options = config.search.openai;
                Object.entries(options).forEach(([key, value]) => {
                    const checkbox = document.querySelector(`#openaiOptions input[name="${key}"]`);
                    if (checkbox) {
                        checkbox.checked = value;
                    }
                });
            }

            // Cargar opciones de SQL
            if (config.sql) {
                Object.entries(config.sql).forEach(([key, value]) => {
                    const input = document.querySelector(`#sqlSection input[name="${key}"]`);
                    if (input) {
                        if (input.type === 'checkbox') {
                            input.checked = value;
                        } else if (input.type === 'number') {
                            input.value = Math.min(Math.max(value, parseInt(input.min)), parseInt(input.max));
                        } else {
                            input.value = value;
                        }
                    }
                });
            }

            // Cargar opciones de Elastic
            if (config.elastic) {
                // Límites
                if (config.elastic.limits) {
                    Object.entries(config.elastic.limits).forEach(([key, value]) => {
                        const input = document.querySelector(`#elasticSection input[name="${key}"]`);
                        if (input) {
                            input.value = Math.min(Math.max(value, parseInt(input.min)), parseInt(input.max));
                            // Actualizar el valor mostrado si es un deslizador
                            if (input.type === 'range') {
                                const valueContainer = input.nextElementSibling;
                                if (valueContainer) {
                                    valueContainer.textContent = `${input.value}%`;
                                }
                            }
                        }
                    });
                }

                // Tipos de búsqueda
                if (config.elastic.searchTypes) {
                    Object.entries(config.elastic.searchTypes).forEach(([type, options]) => {
                        // Checkbox de habilitación
                        const enabled = document.querySelector(`#elasticSection input[name="${type}Enabled"]`);
                        if (enabled) {
                            enabled.checked = options.enabled;
                        }

                        // Valores específicos por tipo
                        if (type === 'exact' && options.priority !== undefined) {
                            const priority = document.querySelector('#elasticSection input[name="exactPriority"]');
                            if (priority) {
                                priority.value = Math.min(Math.max(options.priority, 1), 100);
                                const valueContainer = priority.nextElementSibling;
                                if (valueContainer) {
                                    valueContainer.textContent = `${priority.value}%`;
                                }
                            }
                        } else if (type === 'fuzzy' && options.tolerance !== undefined) {
                            const tolerance = document.querySelector('#elasticSection input[name="fuzzyTolerance"]');
                            if (tolerance) {
                                tolerance.value = Math.min(Math.max(options.tolerance, 1), 100);
                                const valueContainer = tolerance.nextElementSibling;
                                if (valueContainer) {
                                    valueContainer.textContent = `${tolerance.value}%`;
                                }
                            }
                        } else if (type === 'smart' && options.precision !== undefined) {
                            const precision = document.querySelector('#elasticSection input[name="smartPrecision"]');
                            if (precision) {
                                precision.value = Math.min(Math.max(options.precision, 1), 100);
                                const valueContainer = precision.nextElementSibling;
                                if (valueContainer) {
                                    valueContainer.textContent = `${precision.value}%`;
                                }
                            }
                        }
                    });
                }

                // Configuración avanzada
                const showAdvanced = document.getElementById('showAdvanced');
                const advancedOptions = document.getElementById('advancedOptions');
                if (showAdvanced && advancedOptions) {
                    showAdvanced.checked = config.elastic.showAdvanced || false;
                    advancedOptions.style.display = showAdvanced.checked ? 'block' : 'none';
                }
            }

            // Cargar API Keys
            const apiKeys = await window.storage.getApiKeys();
            if (apiKeys) {
                Object.entries(apiKeys).forEach(([provider, key]) => {
                    const input = document.querySelector(`input[name="${provider}Key"]`);
                    if (input && key) {
                        input.value = key;
                        // Actualizar estado si hay key
                        const statusContainer = input.closest('.api-key-group').querySelector('.key-status');
                        const statusIndicator = statusContainer.querySelector('.status-indicator');
                        const statusText = statusContainer.querySelector('.status-text');
                        this.updateKeyStatus(statusIndicator, statusText, 'configured', 'Configurado');
                    }
                });
            }

            // SQL Search Limits
            const sqlSearchLimit = config.sql?.useDefaultLimits ? 'default' : 'custom';
            const sqlSearchLimitRadio = document.querySelector(`input[name="sqlSearchLimit"][value="${sqlSearchLimit}"]`);
            const sqlMaxTotalInput = document.querySelector('input[name="sqlMaxTotal"]');
            
            if (sqlSearchLimitRadio) {
                sqlSearchLimitRadio.checked = true;
                if (sqlMaxTotalInput) {
                    sqlMaxTotalInput.disabled = sqlSearchLimit === 'default';
                    if (sqlSearchLimit === 'custom') {
                        sqlMaxTotalInput.value = config.sql.maxTotal || 150;
                    }
                }
            }

            // SQL Mode
            if (config.sql) {
                const sqlMode = config.sql.strictMode ? 'strict' : 'flexible';
                const sqlModeRadio = document.querySelector(`input[name="sqlMode"][value="${sqlMode}"]`);
                if (sqlModeRadio) {
                    sqlModeRadio.checked = true;
                }
            }

        } catch (error) {
            console.error('Error cargando la configuración:', error);
        }
    }

    async saveAndClose() {
        try {
            const config = {
                search: {
                    ontologyMode: Array.from(this.searchModeRadios)
                        .find(r => r.checked)?.value || 'multi_match',
                    dbMode: Array.from(this.dbModeRadios)
                        .find(r => r.checked)?.value || 'sql',
                    openai: {}
                },
                sql: {
                    maxTotal: 150,
                    maxPerKeyword: 100,
                    maxKeywords: 10,
                    strictMode: true
                },
                elastic: {
                    limits: {
                        maxTotal: 50,
                        maxPerKeyword: 10
                    },
                    searchTypes: {
                        exact: {
                            enabled: true,
                            priority: 10
                        },
                        fuzzy: {
                            enabled: true,
                            tolerance: 2
                        },
                        smart: {
                            enabled: true,
                            precision: 7
                        }
                    },
                    showAdvanced: false
                }
            };

            console.log('Configuración inicial:', config);

            // Guardar opciones de OpenAI
            const openaiCheckboxes = document.querySelectorAll('#openaiOptions input[type="checkbox"]');
            openaiCheckboxes.forEach(checkbox => {
                config.search.openai[checkbox.name] = checkbox.checked;
            });

            // Guardar opciones de SQL
            const sqlInputs = document.querySelectorAll('#sqlSection input');
            sqlInputs.forEach(input => {
                if (input.type === 'checkbox') {
                    config.sql[input.name] = input.checked;
                } else if (input.type === 'number') {
                    const value = parseInt(input.value);
                    const min = parseInt(input.min);
                    const max = parseInt(input.max);
                    config.sql[input.name] = Math.min(Math.max(value, min), max);
                }
            });

            // Guardar opciones de Elastic
            const elasticLimits = document.querySelectorAll('#elasticSection .input-group input');
            elasticLimits.forEach(input => {
                if (input.type === 'number') {
                    const value = parseInt(input.value);
                    const min = parseInt(input.min);
                    const max = parseInt(input.max);
                    config.elastic.limits[input.name] = Math.min(Math.max(value, min), max);
                }
            });

            // Tipos de búsqueda
            ['exact', 'fuzzy', 'smart'].forEach(type => {
                const enabled = document.querySelector(`#elasticSection input[name="${type}Enabled"]`);
                config.elastic.searchTypes[type] = {
                    enabled: enabled?.checked || false
                };

                if (type === 'exact') {
                    const priority = document.querySelector('#elasticSection input[name="exactPriority"]');
                    if (priority) {
                        config.elastic.searchTypes.exact.priority = Math.min(Math.max(parseInt(priority.value), 1), 100);
                    }
                } else if (type === 'fuzzy') {
                    const tolerance = document.querySelector('#elasticSection input[name="fuzzyTolerance"]');
                    if (tolerance) {
                        config.elastic.searchTypes.fuzzy.tolerance = Math.min(Math.max(parseInt(tolerance.value), 1), 10);
                    }
                } else if (type === 'smart') {
                    const precision = document.querySelector('#elasticSection input[name="smartPrecision"]');
                    if (precision) {
                        config.elastic.searchTypes.smart.precision = Math.min(Math.max(parseInt(precision.value), 1), 10);
                    }
                }
            });

            console.log('Configuración antes de guardar:', JSON.stringify(config, null, 2));

            // Crear backup antes de guardar
            await window.storage.createBackup();

            // Guardar configuración
            await window.storage.setConfig(config);

            // Guardar API Keys de forma segura
            const apiKeys = {};
            const keyInputs = document.querySelectorAll('.api-key-group input[type="password"]');
            keyInputs.forEach(input => {
                const provider = input.name.replace('Key', '');
                if (input.value) {
                    apiKeys[provider] = input.value;
                }
            });
            await window.storage.setApiKeys(apiKeys);

            // Obtener cambios y notificar
            const changes = await this.getConfigChanges(config);
            window.dispatchEvent(new CustomEvent('configUpdated', { 
                detail: { 
                    config,
                    changes
                } 
            }));

            // Cerrar el modal
            this.hide();

            // Mostrar notificación de éxito
            notifications.success('Configuración guardada correctamente', 2000);

        } catch (error) {
            console.error('Error detallado al guardar la configuración:', error);
            console.log('Estado actual de la configuración:', config);
            notifications.error('Error al guardar la configuración. Por favor, verifica los valores ingresados.');
        }
    }

    validateConfig(config) {
        try {
            // Validar modo de búsqueda
            if (!['multi_match', 'openai'].includes(config.search.ontologyMode)) {
                return false;
            }

            // Validar modo de base de datos
            if (!['sql', 'elastic'].includes(config.search.dbMode)) {
                return false;
            }

            // Validar opciones de OpenAI
            const requiredOpenAIOptions = [
                'useOriginalTerm',
                'useEnglishTerm',
                'useRelatedTerms',
                'useTestTypes',
                'useKeywords'
            ];
            if (config.search.ontologyMode === 'openai' && 
                !requiredOpenAIOptions.every(opt => typeof config.search.openai[opt] === 'boolean')) {
                return false;
            }

            // Validar opciones de SQL
            if (typeof config.sql.maxTotal !== 'number' || 
                typeof config.sql.maxPerKeyword !== 'number' ||
                typeof config.sql.maxKeywords !== 'number' ||
                typeof config.sql.strictMode !== 'boolean') {
                return false;
            }

            // Validar límites de Elastic
            if (typeof config.elastic.limits.maxTotal !== 'number' ||
                typeof config.elastic.limits.maxPerKeyword !== 'number') {
                return false;
            }

            // Validar tipos de búsqueda de Elastic
            const searchTypes = ['exact', 'fuzzy', 'smart'];
            for (const type of searchTypes) {
                const options = config.elastic.searchTypes[type];
                if (typeof options.enabled !== 'boolean') {
                    return false;
                }

                if (type === 'exact' && (typeof options.priority !== 'number' || 
                    options.priority < 1 || options.priority > 10)) {
                    return false;
                }
                if (type === 'fuzzy' && (typeof options.tolerance !== 'number' || 
                    options.tolerance < 1 || options.tolerance > 5)) {
                    return false;
                }
                if (type === 'smart' && (typeof options.precision !== 'number' || 
                    options.precision < 1 || options.precision > 100)) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('Error validando la configuración:', error);
            return false;
        }
    }

    async getConfigChanges(newConfig) {
        const changes = {
            search: {},
            sql: {},
            elastic: {
                limits: {},
                searchTypes: {}
            }
        };

        try {
            const oldConfig = await window.storage.getConfig();
            if (!oldConfig) return changes;

            // Comparar modo de búsqueda
            if (oldConfig.search.ontologyMode !== newConfig.search.ontologyMode) {
                changes.search.ontologyMode = {
                    old: oldConfig.search.ontologyMode,
                    new: newConfig.search.ontologyMode
                };
            }

            // Comparar opciones de OpenAI
            Object.entries(newConfig.search.openai).forEach(([key, value]) => {
                if (oldConfig.search.openai[key] !== value) {
                    if (!changes.search.openai) changes.search.openai = {};
                    changes.search.openai[key] = {
                        old: oldConfig.search.openai[key],
                        new: value
                    };
                }
            });

            // Comparar opciones de SQL
            Object.entries(newConfig.sql).forEach(([key, value]) => {
                if (oldConfig.sql[key] !== value) {
                    changes.sql[key] = {
                        old: oldConfig.sql[key],
                        new: value
                    };
                }
            });

            // Comparar límites de Elastic
            Object.entries(newConfig.elastic.limits).forEach(([key, value]) => {
                if (oldConfig.elastic.limits[key] !== value) {
                    changes.elastic.limits[key] = {
                        old: oldConfig.elastic.limits[key],
                        new: value
                    };
                }
            });

            // Comparar tipos de búsqueda de Elastic
            Object.entries(newConfig.elastic.searchTypes).forEach(([type, options]) => {
                const oldOptions = oldConfig.elastic.searchTypes[type];
                const typeChanges = {};

                if (oldOptions.enabled !== options.enabled) {
                    typeChanges.enabled = {
                        old: oldOptions.enabled,
                        new: options.enabled
                    };
                }

                if (type === 'exact' && oldOptions.priority !== options.priority) {
                    typeChanges.priority = {
                        old: oldOptions.priority,
                        new: options.priority
                    };
                }
                if (type === 'fuzzy' && oldOptions.tolerance !== options.tolerance) {
                    typeChanges.tolerance = {
                        old: oldOptions.tolerance,
                        new: options.tolerance
                    };
                }
                if (type === 'smart' && oldOptions.precision !== options.precision) {
                    typeChanges.precision = {
                        old: oldOptions.precision,
                        new: options.precision
                    };
                }

                if (Object.keys(typeChanges).length > 0) {
                    changes.elastic.searchTypes[type] = typeChanges;
                }
            });

        } catch (error) {
            console.error('Error obteniendo cambios de configuración:', error);
        }

        return changes;
    }

    async deleteOntology() {
        try {
            if (confirm('¿Estás seguro de que deseas eliminar todos los datos de ontología? Esta acción no se puede deshacer.')) {
                // Aquí deberíamos llamar al endpoint correspondiente
                const response = await fetch('/api/ontology', {
                    method: 'DELETE'
                });

                if (response.ok) {
                    alert('Ontología eliminada correctamente');
                } else {
                    throw new Error('Error al eliminar la ontología');
                }
            }
        } catch (error) {
            console.error('Error eliminando la ontología:', error);
            alert('Error al eliminar la ontología');
        }
    }

    async restoreDefaults() {
        try {
            if (!confirm('¿Estás seguro de que deseas restaurar todos los valores a su configuración predeterminada? Esta acción no se puede deshacer.')) {
                return;
            }

            console.info('[ConfigModal] Iniciando restauración de valores por defecto');
            
            // Intentar resetear la configuración
            const success = await window.storage.resetConfig();
            
            if (success) {
                console.info('[ConfigModal] Configuración reseteada correctamente');
                
                // Recargar la configuración en el modal
                await this.loadConfig();
                
                // Notificar al usuario
                notifications.success('Configuración restaurada correctamente');
            } else {
                throw new Error('No se pudo resetear la configuración');
            }
        } catch (error) {
            console.error('[ConfigModal] Error al restaurar:', error);
            notifications.error('Error al restaurar los valores por defecto: ' + error.message);
        }
    }

    async saveConfig() {
        try {
            const config = await window.storage.getConfig() || {};

            // ... existing code ...

            // Elastic Search
            config.elastic = {
                limits: {
                    maxTotal: parseInt(document.querySelector('#elasticSection input[name="maxTotal"]').value),
                    maxPerKeyword: parseInt(document.querySelector('#elasticSection input[name="maxPerKeyword"]').value)
                },
                searchTypes: {
                    exact: {
                        enabled: document.querySelector('#elasticSection input[name="exactEnabled"]').checked,
                        priority: parseInt(document.querySelector('#elasticSection input[name="exactPriority"]').value)
                    },
                    fuzzy: {
                        enabled: document.querySelector('#elasticSection input[name="fuzzyEnabled"]').checked,
                        tolerance: parseInt(document.querySelector('#elasticSection input[name="fuzzyTolerance"]').value)
                    },
                    smart: {
                        enabled: document.querySelector('#elasticSection input[name="smartEnabled"]').checked,
                        precision: parseInt(document.querySelector('#elasticSection input[name="smartPrecision"]').value)
                    }
                },
                showAdvanced: document.getElementById('showAdvanced').checked
            };

            // ... rest of existing code ...

            // Guardar API Keys
            const apiKeys = {};
            document.querySelectorAll('.api-key-group input[type="password"]').forEach(input => {
                const provider = input.name.replace('Key', '');
                if (input.value) {
                    apiKeys[provider] = input.value;
                }
            });
            await window.storage.setApiKeys(apiKeys);

            // ... rest of existing code ...
        } catch (error) {
            console.error('Error guardando la configuración:', error);
            alert('Error al guardar la configuración');
        }
    }

    updateKeyStatus(indicator, text, status, message) {
        indicator.className = 'status-indicator ' + status;
        text.textContent = message;
    }

    async testApiKey(provider, key) {
        try {
            // Implementar la lógica de prueba para cada proveedor
            const response = await fetch('/api/test-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ provider, key })
            });

            const data = await response.json();
            if (!response.ok) {
                console.warn(`[ConfigModal] Error en prueba de API key ${provider}:`, data.message);
            }
            return { success: response.ok, message: data.message };
        } catch (error) {
            console.error(`[ConfigModal] Error de conexión al probar API key ${provider}:`, error);
            return { success: false, message: 'Error de conexión' };
        }
    }

    initializeElasticSection() {
        // Esperar a que los elementos estén disponibles
        const waitForElements = (selectors) => {
            return new Promise((resolve) => {
                const check = () => {
                    const elements = selectors.map(selector => document.querySelector(selector));
                    if (elements.every(el => el)) {
                        resolve(elements);
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        };

        const requiredSelectors = [
            '#maxTotalResults',
            '#maxPerKeyword',
            '#exactEnabled',
            '#exactPriority',
            '#fuzzyEnabled',
            '#fuzzyTolerance',
            '#smartEnabled',
            '#smartPrecision'
        ];

        // Inicializar cuando los elementos estén disponibles
        waitForElements(requiredSelectors).then(([
            maxTotalSlider,
            maxKeywordSlider,
            exactEnabled,
            exactPriority,
            fuzzyEnabled,
            fuzzyTolerance,
            smartEnabled,
            smartPrecision
        ]) => {
            // Función para actualizar el valor mostrado
            const updateSliderValue = (slider, valueContainer) => {
                if (valueContainer) {
                    valueContainer.textContent = slider.value;
                }
            };

            // Inicializar valores desde la configuración
            const loadElasticConfig = () => {
                const config = window.storage.getConfig();
                if (!config?.elastic) return;

                // Límites
                if (maxTotalSlider && config.elastic.limits?.maxTotal) {
                    maxTotalSlider.value = config.elastic.limits.maxTotal;
                    updateSliderValue(maxTotalSlider, maxTotalSlider.nextElementSibling?.querySelector('.value-container'));
                }
                
                if (maxKeywordSlider && config.elastic.limits?.maxPerKeyword) {
                    maxKeywordSlider.value = config.elastic.limits.maxPerKeyword;
                    updateSliderValue(maxKeywordSlider, maxKeywordSlider.nextElementSibling?.querySelector('.value-container'));
                }

                // Tipos de búsqueda
                if (config.elastic.searchTypes) {
                    // Búsqueda exacta
                    if (exactEnabled && exactPriority) {
                        exactEnabled.checked = config.elastic.searchTypes.exact?.enabled ?? true;
                        exactPriority.value = config.elastic.searchTypes.exact?.priority || 10;
                        updateSliderValue(exactPriority, exactPriority.nextElementSibling?.querySelector('.value-container'));
                    }

                    // Búsqueda difusa
                    if (fuzzyEnabled && fuzzyTolerance) {
                        fuzzyEnabled.checked = config.elastic.searchTypes.fuzzy?.enabled ?? true;
                        fuzzyTolerance.value = config.elastic.searchTypes.fuzzy?.tolerance || 2;
                        updateSliderValue(fuzzyTolerance, fuzzyTolerance.nextElementSibling?.querySelector('.value-container'));
                    }

                    // Búsqueda inteligente
                    if (smartEnabled && smartPrecision) {
                        smartEnabled.checked = config.elastic.searchTypes.smart?.enabled ?? true;
                        smartPrecision.value = config.elastic.searchTypes.smart?.precision || 7;
                        updateSliderValue(smartPrecision, smartPrecision.nextElementSibling?.querySelector('.value-container'));
                    }
                }
            };

            // Guardar configuración cuando cambie
            const saveElasticConfig = () => {
                const config = window.storage.getConfig() || {};
                config.elastic = {
                    limits: {
                        maxTotal: parseInt(maxTotalSlider.value),
                        maxPerKeyword: parseInt(maxKeywordSlider.value)
                    },
                    searchTypes: {
                        exact: {
                            enabled: exactEnabled.checked,
                            priority: parseInt(exactPriority.value)
                        },
                        fuzzy: {
                            enabled: fuzzyEnabled.checked,
                            tolerance: parseInt(fuzzyTolerance.value)
                        },
                        smart: {
                            enabled: smartEnabled.checked,
                            precision: parseInt(smartPrecision.value)
                        }
                    },
                    showAdvanced: document.getElementById('showAdvanced')?.checked || false
                };
                window.storage.setConfig(config);
            };

            // Event listeners para sliders
            const sliders = [maxTotalSlider, maxKeywordSlider, exactPriority, fuzzyTolerance, smartPrecision];
            sliders.forEach(slider => {
                if (slider) {
                    slider.addEventListener('input', (e) => {
                        const valueContainer = e.target.nextElementSibling?.querySelector('.value-container');
                        if (valueContainer) {
                            updateSliderValue(e.target, valueContainer);
                            saveElasticConfig();
                        }
                    });
                }
            });

            // Event listeners para checkboxes
            const checkboxes = [exactEnabled, fuzzyEnabled, smartEnabled];
            checkboxes.forEach(checkbox => {
                if (checkbox) {
                    checkbox.addEventListener('change', saveElasticConfig);
                }
            });

            // Cargar configuración inicial
            loadElasticConfig();
        }).catch(error => {
            console.error('[ConfigModal] Error en sección Elastic:', error);
        });
    }

    // Agregar botón de restaurar backup
    initializeBackupControls() {
        const backupBtn = document.createElement('button');
        backupBtn.textContent = 'Restaurar última configuración';
        backupBtn.classList.add('backup-btn');
        backupBtn.addEventListener('click', async () => {
            if (await window.storage.restoreFromBackup()) {
                await this.loadConfig();
                notifications.success('Configuración restaurada correctamente');
            } else {
                notifications.warning('No hay backup disponible');
            }
        });

        const controlsSection = document.querySelector('.modal-controls');
        if (controlsSection) {
            controlsSection.insertBefore(backupBtn, controlsSection.firstChild);
        }
    }
}

// Create and export a singleton instance
const configModal = new ConfigModal();
export default configModal; 