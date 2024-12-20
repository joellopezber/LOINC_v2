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
        // Verificar que storage esté disponible
        if (!window.storage) {
            console.error('Storage no está disponible, reintentando en 100ms...');
            setTimeout(() => this.init(), 100);
            return;
        }

        console.log('Inicializando modal con storage:', window.storage);

        // Crear el modal
        this.createModal();
        
        // Inicializar referencias
        if (!this.initializeReferences()) {
            console.error('No se pudieron inicializar las referencias del modal');
            return;
        }
        
        // Agregar event listeners
        this.initializeEventListeners();
        
        // Inicializar sección de Elastic
        this.initializeElasticSection();
        
        // Cargar configuración
        this.loadConfig();

        console.log('Modal inicializado correctamente');
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

        this.restoreDefaultsButton?.addEventListener('click', async () => {
            if (confirm('¿Estás seguro de que deseas restaurar todos los valores a su configuración predeterminada? Esta acción no se puede deshacer.')) {
                try {
                    await this.restoreDefaults();
                    alert('Valores restaurados correctamente');
                } catch (error) {
                    alert('Error al restaurar los valores por defecto');
                }
            }
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
    }

    updateSliderValue(slider) {
        const valueContainer = slider.closest('.slider-control').querySelector('.value-container');
        if (valueContainer) {
            valueContainer.textContent = `${slider.value}%`;
        }
    }

    createModal() {
        const modalContainer = document.getElementById('modalContainer');
        if (!modalContainer) {
            console.error('Contenedor del modal no encontrado');
            return;
        }

        modalContainer.innerHTML = `
        <div class="config-modal" id="configModal">
            <div class="config-modal-content">
                <!-- Header -->
                <div class="modal-header">
                    <div class="header-content">
                        <h2>Configuración</h2>
                        <button class="close-button" id="closeConfigModal">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                </div>

                <!-- Navigation -->
                <div class="modal-nav">
                    <button class="nav-item active" data-section="search">
                        <span class="material-icons">search</span>
                        <span>Búsqueda</span>
                    </button>
                    <button class="nav-item" data-section="elastic">
                        <span class="material-icons">analytics</span>
                        <span>Elastic</span>
                    </button>
                    <button class="nav-item" data-section="sql">
                        <span class="material-icons">storage</span>
                        <span>SQL</span>
                    </button>
                    <button class="nav-item" data-section="config">
                        <span class="material-icons">settings</span>
                        <span>Config</span>
                    </button>
                </div>

                <!-- Body -->
                <div class="modal-body">
                    <!-- Search Section -->
                    <div class="config-section active" id="searchSection">
                        <div class="option-group">
                            <h3>Modo de Búsqueda</h3>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="searchMode" value="multi_match" checked>
                                    <div class="radio-content">
                                        <div class="radio-title">Multi Match</div>
                                        <div class="radio-description">Búsqueda directa en la base de datos utilizando coincidencia múltiple</div>
                                    </div>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="searchMode" value="openai">
                                    <div class="radio-content">
                                        <div class="radio-title">OpenAI</div>
                                        <div class="radio-description">Búsqueda asistida por IA utilizando OpenAI</div>
                                    </div>
                                </label>

                                <!-- OpenAI Options (nested) -->
                                <div id="openaiOptions" class="openai-options" style="display: none;">
                                    <div class="checkbox-grid">
                                        <label class="checkbox-option compact">
                                            <input type="checkbox" name="useOriginalTerm" checked>
                                            <div class="checkbox-content">
                                                <div class="checkbox-title">Usar término original</div>
                                                <div class="checkbox-description">Incluir el término de búsqueda original</div>
                                            </div>
                                        </label>
                                        <label class="checkbox-option compact">
                                            <input type="checkbox" name="useEnglishTerm" checked>
                                            <div class="checkbox-content">
                                                <div class="checkbox-title">Usar término en inglés</div>
                                                <div class="checkbox-description">Traducir y usar el término en inglés</div>
                                            </div>
                                        </label>
                                        <label class="checkbox-option compact">
                                            <input type="checkbox" name="useRelatedTerms" checked>
                                            <div class="checkbox-content">
                                                <div class="checkbox-title">Usar términos relacionados</div>
                                                <div class="checkbox-description">Incluir términos relacionados en la búsqueda</div>
                                            </div>
                                        </label>
                                        <label class="checkbox-option compact">
                                            <input type="checkbox" name="useTestTypes" checked>
                                            <div class="checkbox-content">
                                                <div class="checkbox-title">Usar tipos de prueba</div>
                                                <div class="checkbox-description">Incluir tipos de prueba relacionados</div>
                                            </div>
                                        </label>
                                        <label class="checkbox-option compact">
                                            <input type="checkbox" name="useLoincCodes" checked>
                                            <div class="checkbox-content">
                                                <div class="checkbox-title">Usar códigos LOINC</div>
                                                <div class="checkbox-description">Incluir códigos LOINC relacionados</div>
                                            </div>
                                        </label>
                                        <label class="checkbox-option compact">
                                            <input type="checkbox" name="useKeywords" checked>
                                            <div class="checkbox-content">
                                                <div class="checkbox-title">Usar palabras clave</div>
                                                <div class="checkbox-description">Incluir palabras clave relacionadas</div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="option-group">
                            <h3>Base de Datos</h3>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="dbMode" value="sql" checked>
                                    <div class="radio-content">
                                        <div class="radio-title">SQL</div>
                                        <div class="radio-description">Búsqueda en base de datos SQL para resultados precisos</div>
                                    </div>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="dbMode" value="elastic">
                                    <div class="radio-content">
                                        <div class="radio-title">Elasticsearch</div>
                                        <div class="radio-description">Búsqueda avanzada con Elasticsearch para mayor flexibilidad</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div id="openaiOptions" class="option-group" style="display: none;">
                            <h3>Opciones de OpenAI</h3>
                            <div class="checkbox-group">
                                <label class="checkbox-option">
                                    <input type="checkbox" name="useOriginalTerm" checked>
                                    <div class="checkbox-content">
                                        <div class="checkbox-title">Usar término original</div>
                                        <div class="checkbox-description">Incluir el término de búsqueda original</div>
                                    </div>
                                </label>
                                <label class="checkbox-option">
                                    <input type="checkbox" name="useEnglishTerm" checked>
                                    <div class="checkbox-content">
                                        <div class="checkbox-title">Usar término en inglés</div>
                                        <div class="checkbox-description">Traducir y usar el término en inglés</div>
                                    </div>
                                </label>
                                <label class="checkbox-option">
                                    <input type="checkbox" name="useRelatedTerms" checked>
                                    <div class="checkbox-content">
                                        <div class="checkbox-title">Usar términos relacionados</div>
                                        <div class="checkbox-description">Incluir términos relacionados en la búsqueda</div>
                                    </div>
                                </label>
                                <label class="checkbox-option">
                                    <input type="checkbox" name="useTestTypes" checked>
                                    <div class="checkbox-content">
                                        <div class="checkbox-title">Usar tipos de prueba</div>
                                        <div class="checkbox-description">Incluir tipos de prueba relacionados</div>
                                    </div>
                                </label>
                                <label class="checkbox-option">
                                    <input type="checkbox" name="useLoincCodes" checked>
                                    <div class="checkbox-content">
                                        <div class="checkbox-title">Usar códigos LOINC</div>
                                        <div class="checkbox-description">Incluir códigos LOINC relacionados</div>
                                    </div>
                                </label>
                                <label class="checkbox-option">
                                    <input type="checkbox" name="useKeywords" checked>
                                    <div class="checkbox-content">
                                        <div class="checkbox-title">Usar palabras clave</div>
                                        <div class="checkbox-description">Incluir palabras clave relacionadas</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- SQL Section -->
                    <div class="config-section" id="sqlSection">
                        <div class="option-group">
                            <div class="section-header">
                                <h3>Límites de Búsqueda</h3>
                                <small class="info-text">Configura los límites generales de la búsqueda SQL</small>
                            </div>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="number" name="sqlMaxTotal" min="1" max="1000" value="150">
                                    <div class="radio-content">
                                        <div class="radio-title">Límite total de resultados</div>
                                        <div class="radio-description">Número máximo total de resultados a mostrar</div>
                                    </div>
                                </label>
                                <label class="radio-option">
                                    <input type="number" name="sqlMaxPerKeyword" min="1" max="100" value="100">
                                    <div class="radio-content">
                                        <div class="radio-title">Resultados por palabra clave</div>
                                        <div class="radio-description">Número máximo de resultados por cada palabra clave</div>
                                    </div>
                                </label>
                                <label class="radio-option">
                                    <input type="number" name="sqlMaxKeywords" min="1" max="20" value="10">
                                    <div class="radio-content">
                                        <div class="radio-title">Máximo de palabras clave</div>
                                        <div class="radio-description">Número máximo de palabras clave a procesar</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div class="option-group">
                            <div class="section-header">
                                <h3>Modo de Búsqueda</h3>
                                <small class="info-text">Configura la precisión de la búsqueda SQL</small>
                            </div>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="checkbox" id="sqlStrictMode" name="sqlStrictMode" checked>
                                    <div class="radio-content">
                                        <div class="radio-title">Modo Estricto</div>
                                        <div class="radio-description">Activa la búsqueda de coincidencias exactas para resultados más precisos</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Elastic Section -->
                    <div class="config-section" id="elasticSection">
                        <div class="option-group">
                            <div class="section-header">
                                <h3>Límites de Resultados</h3>
                                <small class="info-text">Configura los límites generales de búsqueda</small>
                            </div>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="number" name="maxTotal" min="1" max="1000" value="150">
                                    <div class="radio-content">
                                        <div class="radio-title">Límite total de resultados</div>
                                        <div class="radio-description">Define el número máximo total de resultados</div>
                                    </div>
                                </label>
                                <label class="radio-option">
                                    <input type="number" name="maxPerKeyword" min="1" max="100" value="100">
                                    <div class="radio-content">
                                        <div class="radio-title">Límite por palabra clave</div>
                                        <div class="radio-description">Define el número máximo de resultados por cada palabra clave</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div class="option-group">
                            <div class="section-header">
                                <h3>Tipos de Búsqueda</h3>
                                <small class="info-text">Configura los diferentes métodos de búsqueda disponibles</small>
                            </div>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="checkbox" id="exactSearch" name="exactEnabled" checked>
                                    <div class="radio-content">
                                        <div class="radio-title">Búsqueda Exacta</div>
                                        <div class="radio-description">Encuentra coincidencias exactas con el término buscado</div>
                                        <div class="slider-control">
                                            <span>Prioridad</span>
                                            <input type="range" name="exactPriority" min="0" max="100" value="75">
                                            <span class="value-container">75%</span>
                                        </div>
                                    </div>
                                </label>

                                <label class="radio-option">
                                    <input type="checkbox" id="fuzzySearch" name="fuzzyEnabled" checked>
                                    <div class="radio-content">
                                        <div class="radio-title">Búsqueda Aproximada</div>
                                        <div class="radio-description">Encuentra términos similares, tolerando errores tipográficos</div>
                                        <div class="slider-control">
                                            <span>Tolerancia</span>
                                            <input type="range" name="fuzzyTolerance" min="0" max="100" value="50">
                                            <span class="value-container">50%</span>
                                        </div>
                                    </div>
                                </label>

                                <label class="radio-option">
                                    <input type="checkbox" id="smartSearch" name="smartEnabled" checked>
                                    <div class="radio-content">
                                        <div class="radio-title">Búsqueda Inteligente</div>
                                        <div class="radio-description">Búsqueda avanzada con análisis semántico</div>
                                        <div class="slider-control">
                                            <span>Precisión</span>
                                            <input type="range" name="smartPrecision" min="0" max="100" value="75">
                                            <span class="value-container">75%</span>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div class="option-group">
                            <div class="section-header">
                                <div class="header-with-toggle">
                                    <h3>Configuración Avanzada</h3>
                                    <div class="toggle-container">
                                        <input type="checkbox" id="showAdvanced" class="toggle-checkbox">
                                        <label for="showAdvanced" class="toggle-label">Mostrar opciones avanzadas</label>
                                    </div>
                                </div>
                                <small class="info-text">Opciones adicionales para búsquedas especializadas</small>
                            </div>
                            <div id="advancedOptions" style="display: none;">
                                <div class="radio-group">
                                    <label class="radio-option">
                                        <input type="checkbox" id="prefixSearch" name="prefixEnabled">
                                        <div class="radio-content">
                                            <div class="radio-title">Búsqueda por Prefijo</div>
                                            <div class="radio-description">Encuentra términos que comienzan con el texto ingresado</div>
                                            <div class="param-controls">
                                                <span>Longitud mínima</span>
                                                <input type="number" name="prefixMinLength" min="1" max="10" value="3">
                                                <span class="unit">caracteres</span>
                                            </div>
                                        </div>
                                    </label>

                                    <label class="radio-option">
                                        <input type="checkbox" id="wildcardSearch" name="wildcardEnabled">
                                        <div class="radio-content">
                                            <div class="radio-title">Búsqueda con Comodines</div>
                                            <div class="radio-description">Usa caracteres comodín (* o ?) en la búsqueda</div>
                                            <div class="param-controls">
                                                <span>Máximo de comodines</span>
                                                <input type="number" name="maxWildcards" min="1" max="5" value="2">
                                                <span class="unit">por término</span>
                                            </div>
                                        </div>
                                    </label>

                                    <label class="radio-option">
                                        <input type="checkbox" id="regexSearch" name="regexEnabled">
                                        <div class="radio-content">
                                            <div class="radio-title">Búsqueda con Expresiones Regulares</div>
                                            <div class="radio-description">Usa expresiones regulares para búsquedas avanzadas</div>
                                            <div class="slider-control">
                                                <span>Complejidad</span>
                                                <input type="range" name="regexComplexity" min="0" max="100" value="50">
                                                <span class="value-container">50%</span>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Config Section -->
                    <div class="config-section" id="configSection">
                        <div class="option-group">
                            <div class="section-header">
                                <h3>Gestión de Datos</h3>
                                <small class="info-text">Administra los datos y la configuración del sistema</small>
                            </div>
                            <div class="action-group">
                                <div class="action-item">
                                    <button class="btn-action" id="exportConfig">
                                        <span class="material-icons">file_download</span>
                                        Exportar Configuración
                                    </button>
                                    <small class="info-text">Descarga un archivo JSON con toda la configuración</small>
                                </div>
                                <div class="action-item">
                                    <button class="btn-action" id="importConfig">
                                        <span class="material-icons">file_upload</span>
                                        Importar Configuración
                                    </button>
                                    <small class="info-text">Carga un archivo de configuración previamente exportado</small>
                                </div>
                                <div class="action-item">
                                    <button class="btn-action warning" id="deleteOntology">
                                        <span class="material-icons">delete_forever</span>
                                        Eliminar Ontología
                                    </button>
                                    <small class="info-text">Elimina todos los datos de ontología almacenados</small>
                                </div>
                                <div class="action-item">
                                    <button class="btn-action warning" id="restoreDefaults">
                                        <span class="material-icons">restore</span>
                                        Restaurar Valores
                                    </button>
                                    <small class="info-text">Restablece todas las configuraciones a sus valores predeterminados</small>
                                </div>
                            </div>
                        </div>

                        <div class="option-group">
                            <div class="section-header">
                                <h3>Rendimiento</h3>
                                <small class="info-text">Configura aspectos de rendimiento del sistema</small>
                            </div>
                            <div class="input-group">
                                <label>
                                    <span>Caché máximo</span>
                                    <div class="param-controls">
                                        <input type="number" name="maxCacheSize" min="10" max="1000" value="100">
                                        <span class="unit">MB</span>
                                    </div>
                                    <small class="info-text">Tamaño máximo de la caché en memoria</small>
                                </label>
                                <label>
                                    <span>Tiempo de caché</span>
                                    <div class="param-controls">
                                        <input type="number" name="cacheExpiry" min="1" max="72" value="24">
                                        <span class="unit">horas</span>
                                    </div>
                                    <small class="info-text">Tiempo de expiración de la caché</small>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="modal-footer">
                    <button class="btn-close" id="cancelConfig">Cancelar</button>
                    <button class="btn-save" id="saveConfig">Guardar</button>
                </div>
            </div>
        </div>`;
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

        // Update navigation
        this.navItems.forEach(item => {
            const isActive = item.dataset.section === sectionId;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', isActive);
        });

        // Show selected section, hide others
        Object.entries(this.sections).forEach(([id, element]) => {
            if (element) {
                const isActive = id === sectionId;
                element.classList.toggle('active', isActive);
                element.style.display = isActive ? 'block' : 'none';
                element.setAttribute('aria-hidden', !isActive);
            }
        });

        // Actualizar OpenAI options si estamos en la sección de búsqueda
        if (sectionId === 'search') {
            this.toggleOpenAIOptions();
        }
    }

    toggleOpenAIOptions() {
        if (!this.openaiOptions || !this.searchModeRadios) return;
        
        const openaiMode = Array.from(this.searchModeRadios)
            .find(radio => radio.checked)?.value === 'openai';
            
        if (openaiMode) {
            this.openaiOptions.style.display = 'block';
            // Dar tiempo al navegador para aplicar el display: block
            setTimeout(() => {
                this.openaiOptions.classList.add('visible');
            }, 10);
        } else {
            this.openaiOptions.classList.remove('visible');
            // Esperar a que termine la animación antes de ocultar
            setTimeout(() => {
                this.openaiOptions.style.display = 'none';
            }, 200);
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
                sql: {},
                elastic: {
                    limits: {},
                    searchTypes: {
                        exact: {},
                        fuzzy: {},
                        smart: {}
                    }
                }
            };

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
                } else {
                    config.sql[input.name] = input.value;
                }
            });

            // Guardar opciones de Elastic
            // Límites
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
            const searchTypes = ['exact', 'fuzzy', 'smart'];
            searchTypes.forEach(type => {
                const enabled = document.querySelector(`#elasticSection input[name="${type}Enabled"]`);
                config.elastic.searchTypes[type].enabled = enabled?.checked || false;

                if (type === 'exact') {
                    const priority = document.querySelector('#elasticSection input[name="exactPriority"]');
                    if (priority) {
                        const value = parseInt(priority.value);
                        config.elastic.searchTypes.exact.priority = Math.min(Math.max(value, 1), 100);
                    }
                } else if (type === 'fuzzy') {
                    const tolerance = document.querySelector('#elasticSection input[name="fuzzyTolerance"]');
                    if (tolerance) {
                        const value = parseInt(tolerance.value);
                        config.elastic.searchTypes.fuzzy.tolerance = Math.min(Math.max(value, 1), 100);
                    }
                } else if (type === 'smart') {
                    const precision = document.querySelector('#elasticSection input[name="smartPrecision"]');
                    if (precision) {
                        const value = parseInt(precision.value);
                        config.elastic.searchTypes.smart.precision = Math.min(Math.max(value, 1), 100);
                    }
                }
            });

            // Validar configuración
            if (!this.validateConfig(config)) {
                throw new Error('Configuración inválida');
            }

            // Guardar configuración
            await window.storage.setConfig(config);

            // Notificar cambios
            window.dispatchEvent(new CustomEvent('configUpdated', { 
                detail: { 
                    config,
                    changes: this.getConfigChanges(config)
                } 
            }));

            // Cerrar modal
            this.hide();

        } catch (error) {
            console.error('Error guardando la configuración:', error);
            alert('Error al guardar la configuración');
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

    getConfigChanges(newConfig) {
        const changes = {
            search: {},
            sql: {},
            elastic: {
                limits: {},
                searchTypes: {}
            }
        };

        try {
            const oldConfig = window.storage.getConfig();
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
                const changes = {};

                if (oldOptions.enabled !== options.enabled) {
                    changes.enabled = {
                        old: oldOptions.enabled,
                        new: options.enabled
                    };
                }

                if (type === 'exact' && oldOptions.priority !== options.priority) {
                    changes.priority = {
                        old: oldOptions.priority,
                        new: options.priority
                    };
                }
                if (type === 'fuzzy' && oldOptions.tolerance !== options.tolerance) {
                    changes.tolerance = {
                        old: oldOptions.tolerance,
                        new: options.tolerance
                    };
                }
                if (type === 'smart' && oldOptions.precision !== options.precision) {
                    changes.precision = {
                        old: oldOptions.precision,
                        new: options.precision
                    };
                }

                if (Object.keys(changes).length > 0) {
                    changes.elastic.searchTypes[type] = changes;
                }
            });

        } catch (error) {
            console.error('Error obteniendo cambios de configuración:', error);
        }

        return changes;
    }

    async deleteOntology() {
        try {
            await window.storage.deleteOntology();
            alert('Ontología eliminada correctamente');
        } catch (error) {
            console.error('Error eliminando la ontología:', error);
            alert('Error al eliminar la ontología');
        }
    }

    async restoreDefaults() {
        try {
            await window.storage.restoreDefaults();
            await this.loadConfig();
            alert('Valores restaurados correctamente');
        } catch (error) {
            console.error('Error restaurando valores por defecto:', error);
            alert('Error al restaurar los valores por defecto');
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
            return {
                success: response.ok,
                message: data.message
            };
        } catch (error) {
            console.error(`Error probando API key de ${provider}:`, error);
            return {
                success: false,
                message: 'Error de conexión'
            };
        }
    }

    initializeElasticSection() {
        // Sliders para límites
        const maxTotalSlider = document.getElementById('maxTotalResults');
        const maxKeywordSlider = document.getElementById('maxPerKeyword');
        
        // Controles de tipos de búsqueda
        const exactEnabled = document.getElementById('exactEnabled');
        const exactPriority = document.getElementById('exactPriority');
        const fuzzyEnabled = document.getElementById('fuzzyEnabled');
        const fuzzyTolerance = document.getElementById('fuzzyTolerance');
        const smartEnabled = document.getElementById('smartEnabled');
        const smartPrecision = document.getElementById('smartPrecision');

        if (!maxTotalSlider || !maxKeywordSlider || !exactEnabled || !exactPriority || 
            !fuzzyEnabled || !fuzzyTolerance || !smartEnabled || !smartPrecision) {
            console.error('No se pudieron encontrar todos los elementos de Elastic');
            return;
        }

        // Función para actualizar el valor mostrado
        const updateSliderValue = (slider, valueContainer) => {
            valueContainer.textContent = slider.value;
        };

        // Inicializar valores desde la configuración
        const loadElasticConfig = () => {
            const config = window.storage.getConfig();
            if (!config?.elastic) return;

            // Límites
            maxTotalSlider.value = config.elastic.limits?.maxTotal || 50;
            maxKeywordSlider.value = config.elastic.limits?.maxPerKeyword || 10;
            updateSliderValue(maxTotalSlider, maxTotalSlider.nextElementSibling.querySelector('.value-container'));
            updateSliderValue(maxKeywordSlider, maxKeywordSlider.nextElementSibling.querySelector('.value-container'));

            // Tipos de búsqueda
            if (config.elastic.searchTypes) {
                // Búsqueda exacta
                exactEnabled.checked = config.elastic.searchTypes.exact?.enabled ?? true;
                exactPriority.value = config.elastic.searchTypes.exact?.priority || 10;
                updateSliderValue(exactPriority, exactPriority.nextElementSibling.querySelector('.value-container'));

                // Búsqueda difusa
                fuzzyEnabled.checked = config.elastic.searchTypes.fuzzy?.enabled ?? true;
                fuzzyTolerance.value = config.elastic.searchTypes.fuzzy?.tolerance || 2;
                updateSliderValue(fuzzyTolerance, fuzzyTolerance.nextElementSibling.querySelector('.value-container'));

                // Búsqueda inteligente
                smartEnabled.checked = config.elastic.searchTypes.smart?.enabled ?? true;
                smartPrecision.value = config.elastic.searchTypes.smart?.precision || 7;
                updateSliderValue(smartPrecision, smartPrecision.nextElementSibling.querySelector('.value-container'));
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
                }
            };
            window.storage.saveConfig(config);
        };

        // Event listeners para sliders
        const sliders = [maxTotalSlider, maxKeywordSlider, exactPriority, fuzzyTolerance, smartPrecision];
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const valueContainer = e.target.nextElementSibling.querySelector('.value-container');
                if (valueContainer) {
                    updateSliderValue(e.target, valueContainer);
                    saveElasticConfig();
                }
            });
        });

        // Event listeners para checkboxes
        const checkboxes = [exactEnabled, fuzzyEnabled, smartEnabled];
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', saveElasticConfig);
        });

        // Cargar configuración inicial
        loadElasticConfig();
    }
}

// Create and export a singleton instance
const configModal = new ConfigModal();
export default configModal; 