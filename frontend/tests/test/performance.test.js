import { storage } from '../../static/js/utils/storage.js';
import { encryption } from '../../static/js/utils/encryption.js';
import { apiKeyService } from '../../static/js/services/api-key.service.js';

class PerformanceTest {
    constructor() {
        this.results = [];
        this.testConfig = {
            iterations: 100,
            dataSize: 1000
        };
    }

    async runAll() {
        console.log('🚀 Iniciando pruebas de rendimiento...');
        
        await this.testStorageOperations();
        await this.testEncryption();
        await this.testApiKeys();
        
        this.printResults();
    }

    async testStorageOperations() {
        console.log('📊 Probando operaciones de almacenamiento...');
        
        // Test setConfig
        const start1 = performance.now();
        for(let i = 0; i < this.testConfig.iterations; i++) {
            const testConfig = this.generateTestConfig();
            await storage.setConfig(testConfig);
        }
        const end1 = performance.now();
        this.results.push({
            name: 'Storage setConfig',
            time: (end1 - start1) / this.testConfig.iterations,
            operations: this.testConfig.iterations
        });

        // Test getConfig
        const start2 = performance.now();
        for(let i = 0; i < this.testConfig.iterations; i++) {
            await storage.getConfig();
        }
        const end2 = performance.now();
        this.results.push({
            name: 'Storage getConfig',
            time: (end2 - start2) / this.testConfig.iterations,
            operations: this.testConfig.iterations
        });
    }

    async testEncryption() {
        console.log('🔐 Probando operaciones de encriptación...');
        
        const testData = 'x'.repeat(this.testConfig.dataSize);
        let encryptedData;

        // Test encrypt
        const start1 = performance.now();
        for(let i = 0; i < this.testConfig.iterations; i++) {
            encryptedData = await encryption.encrypt(testData);
        }
        const end1 = performance.now();
        this.results.push({
            name: 'Encryption encrypt',
            time: (end1 - start1) / this.testConfig.iterations,
            operations: this.testConfig.iterations
        });

        // Test decrypt
        const start2 = performance.now();
        for(let i = 0; i < this.testConfig.iterations; i++) {
            await encryption.decrypt(encryptedData);
        }
        const end2 = performance.now();
        this.results.push({
            name: 'Encryption decrypt',
            time: (end2 - start2) / this.testConfig.iterations,
            operations: this.testConfig.iterations
        });
    }

    async testApiKeys() {
        console.log('🔑 Probando operaciones de API Keys...');
        
        const testKey = 'sk-test-'.repeat(10);
        
        // Test saveApiKey
        const start1 = performance.now();
        for(let i = 0; i < this.testConfig.iterations; i++) {
            await apiKeyService.saveApiKey('test', testKey);
        }
        const end1 = performance.now();
        this.results.push({
            name: 'ApiKey save',
            time: (end1 - start1) / this.testConfig.iterations,
            operations: this.testConfig.iterations
        });

        // Test getApiKey
        const start2 = performance.now();
        for(let i = 0; i < this.testConfig.iterations; i++) {
            await apiKeyService.getApiKey('test');
        }
        const end2 = performance.now();
        this.results.push({
            name: 'ApiKey get',
            time: (end2 - start2) / this.testConfig.iterations,
            operations: this.testConfig.iterations
        });
    }

    generateTestConfig() {
        return {
            search: {
                ontologyMode: Math.random() > 0.5 ? 'multi_match' : 'openai',
                dbMode: Math.random() > 0.5 ? 'sql' : 'elastic',
                openai: {
                    useOriginalTerm: Math.random() > 0.5,
                    useEnglishTerm: Math.random() > 0.5,
                    useRelatedTerms: Math.random() > 0.5,
                    useTestTypes: Math.random() > 0.5,
                    useLoincCodes: Math.random() > 0.5,
                    useKeywords: Math.random() > 0.5
                }
            },
            elastic: {
                limits: {
                    maxTotal: Math.floor(Math.random() * 1000) + 1,
                    maxPerKeyword: Math.floor(Math.random() * 100) + 1
                },
                searchTypes: {
                    exact: {
                        enabled: Math.random() > 0.5,
                        priority: Math.floor(Math.random() * 100) + 1
                    },
                    fuzzy: {
                        enabled: Math.random() > 0.5,
                        tolerance: Math.floor(Math.random() * 10) + 1
                    },
                    smart: {
                        enabled: Math.random() > 0.5,
                        precision: Math.floor(Math.random() * 10) + 1
                    }
                },
                showAdvanced: Math.random() > 0.5
            }
        };
    }

    printResults() {
        console.log('\n📊 Resultados de las pruebas de rendimiento:');
        console.table(this.results.map(result => ({
            'Operación': result.name,
            'Tiempo promedio (ms)': result.time.toFixed(2),
            'Operaciones': result.operations
        })));

        // Análisis de resultados
        const slowOperations = this.results.filter(r => r.time > 100);
        if (slowOperations.length > 0) {
            console.warn('\n⚠️ Operaciones lentas detectadas:');
            slowOperations.forEach(op => {
                console.warn(`- ${op.name}: ${op.time.toFixed(2)}ms`);
            });
        } else {
            console.log('\n✅ Todas las operaciones tienen un rendimiento aceptable');
        }
    }
}

// Ejecutar pruebas
const performanceTest = new PerformanceTest();
performanceTest.runAll().catch(console.error); 