import { BaseTester } from './base.js';

export class OntologyTester extends BaseTester {
    constructor() {
        super();
        console.log('🔄 Inicializando OntologyTester');
        this.service = null;
        this.unsubscribe = null;
        this.onSearchResult = null;
        this.testResults = new Map();
    }

    async initialize() {
        try {
            console.log('🔄 Iniciando inicialización del tester');
            
            const { ontologyService } = await import('/static/js/services/ontology.service.js');
            this.service = ontologyService;

            this.unsubscribe = this.service.addListener((response) => {
                console.log('📩 Tester recibió respuesta:', response);
                
                if (response.status === 'success') {
                    console.log('✅ Respuesta válida, datos:', response.response);
                    this.onSearchResult?.(response.response);
                } else {
                    console.error('❌ Error en respuesta:', response.message);
                    this.onError?.(new Error(response.message));
                }
            });

            // Escuchar resultados de test
            this._ws.on('ontology.test_result', (response) => {
                console.log('📩 Resultado de test recibido:', response);
                this.handleTestResult(response);
            });

            console.log('✅ Tester inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando tester:', error);
            this.onError?.(error);
        }
    }

    async search(query) {
        try {
            if (!this.isConnected) {
                throw new Error('No hay conexión con el servidor');
            }

            console.log('🔍 Tester: Iniciando búsqueda:', query);
            await this.service.search(query);
            console.log('✅ Tester: Búsqueda enviada');
        } catch (error) {
            console.error('❌ Tester: Error en búsqueda:', error);
            this.onError?.(error);
        }
    }

    async runTest(testCase) {
        try {
            if (!this.isConnected) {
                throw new Error('No hay conexión con el servidor');
            }

            const testId = `test_${Date.now()}`;
            console.log(`🧪 Iniciando test ${testId}:`, testCase);

            // Guardar información del test
            this.testResults.set(testId, {
                status: 'running',
                startTime: Date.now(),
                testCase
            });

            // Enviar test al servidor
            await this._ws.sendRequest('ontology.test', {
                test_id: testId,
                ...testCase
            });

            return testId;

        } catch (error) {
            console.error('❌ Error ejecutando test:', error);
            this.onError?.(error);
        }
    }

    handleTestResult(response) {
        const { test_id, status, result, error } = response;
        
        if (!this.testResults.has(test_id)) {
            console.warn('⚠️ Resultado recibido para test desconocido:', test_id);
            return;
        }

        const testInfo = this.testResults.get(test_id);
        testInfo.endTime = Date.now();
        testInfo.duration = testInfo.endTime - testInfo.startTime;

        if (status === 'success') {
            testInfo.status = 'passed';
            testInfo.result = result;
            console.log(`✅ Test ${test_id} completado en ${testInfo.duration}ms:`, result);
        } else {
            testInfo.status = 'failed';
            testInfo.error = error;
            console.error(`❌ Test ${test_id} falló en ${testInfo.duration}ms:`, error);
        }

        // Notificar resultado
        this.onTestComplete?.(test_id, testInfo);
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
        console.log('🧹 Tester: Limpiando recursos');
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.service = null;
        this.testResults.clear();
        super.disconnect();
    }
} 