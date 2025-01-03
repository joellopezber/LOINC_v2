import { BaseTester } from './base.js';

export class SearchDBTester extends BaseTester {
    constructor() {
        super();
        console.log('🏗️ Inicializando SearchDBTester');
        this.service = null;
        this.unsubscribe = null;
        this.onSearchResult = null;
        this.onStatusUpdate = null;
        this.testResults = new Map();
        
        // Iniciar el proceso de inicialización inmediatamente
        this._initializationPromise = this._initializeService().catch(error => {
            console.error('❌ Error en inicialización automática:', error);
            this.onError?.(error);
            throw error;
        });
    }

    async initialize() {
        try {
            console.log('🔄 Iniciando inicialización del tester');
            await this._initializationPromise;
            console.log('✅ Tester inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando tester:', error);
            this.onError?.(error);
            throw error;
        }
    }

    async _initializeService() {
        const { databaseSearchService } = await import('/static/js/services/database.search.service.js');
        this.service = databaseSearchService;

        this.unsubscribe = this.service.addListener((response) => {
            console.log('📩 Tester recibió respuesta:', response);
            
            if (response.status === 'success') {
                if ('service_status' in response) {
                    console.log('📊 Estado del servicio recibido');
                    this.onStatusUpdate?.(response.service_status);
                } else if ('test_id' in response) {
                    console.log('🧪 Resultado de test recibido');
                    this.handleTestResult(response.test_id, response);
                } else {
                    console.log('✅ Resultado de búsqueda recibido');
                    this.onSearchResult?.(response);
                }
            } else {
                console.error('❌ Error en respuesta:', response.message);
                this.onError?.(new Error(response.message));
            }
        });
    }

    async _ensureServiceInitialized() {
        if (!this._initializationPromise) {
            throw new Error('El tester no ha sido inicializado');
        }
        await this._initializationPromise;
        if (!this.service) {
            throw new Error('El servicio no está disponible');
        }
    }

    async search(query) {
        try {
            await this._ensureServiceInitialized();
            if (!this.isConnected) {
                throw new Error('No hay conexión con el servidor');
            }

            console.log('🔍 Tester: Iniciando búsqueda:', query);
            await this.service.search(query);
            console.log('✅ Tester: Búsqueda enviada');
        } catch (error) {
            console.error('❌ Tester: Error en búsqueda:', error);
            this.onError?.(error);
            throw error;
        }
    }

    async runTest(testCase) {
        try {
            await this._ensureServiceInitialized();
            if (!this.isConnected) {
                throw new Error('No hay conexión con el servidor');
            }

            const testId = `test_${Date.now()}`;
            console.log(`🧪 Iniciando test ${testId}:`, testCase);

            this.testResults.set(testId, {
                status: 'running',
                startTime: Date.now(),
                testCase
            });

            await this.service.runTest({
                test_id: testId,
                ...testCase
            });

            return testId;

        } catch (error) {
            console.error('❌ Error ejecutando test:', error);
            this.onError?.(error);
            throw error;
        }
    }

    handleTestResult(testId, response) {
        const testInfo = this.testResults.get(testId);
        if (!testInfo) {
            console.warn('⚠️ Resultado recibido para test desconocido:', testId);
            return;
        }

        testInfo.endTime = Date.now();
        testInfo.duration = testInfo.endTime - testInfo.startTime;

        if (response?.status === 'success') {
            testInfo.status = 'passed';
            testInfo.result = response.response;
            console.log(`✅ Test ${testId} completado en ${testInfo.duration}ms:`, response.response);
        } else {
            testInfo.status = 'failed';
            testInfo.error = response.message || 'Error desconocido';
            console.error(`❌ Test ${testId} falló en ${testInfo.duration}ms:`, testInfo.error);
        }

        // Notificar resultado
        this.onTestComplete?.(testId, testInfo);
    }

    async getServiceStatus() {
        try {
            await this._ensureServiceInitialized();
            if (!this.isConnected) {
                throw new Error('No hay conexión con el servidor');
            }

            return this.service.getStatus();
        } catch (error) {
            console.error('❌ Error obteniendo estado:', error);
            this.onError?.(error);
            throw error;
        }
    }

    getTestResults() {
        return Array.from(this.testResults.entries()).map(([id, info]) => ({
            id,
            ...info
        }));
    }

    clearTestResults() {
        this.testResults.clear();
    }

    disconnect() {
        console.log('🧹 SearchDBTester: Limpiando recursos');
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.service = null;
        this.testResults.clear();
        super.disconnect();
    }
} 