// Importar el servicio de storage
import { StorageService } from '../../../static/js/services/storage.js';

describe('StorageService', () => {
    let storage;

    beforeEach(() => {
        // Limpiar localStorage antes de cada test
        localStorage.clear();
        storage = new StorageService();
    });

    describe('saveConfig', () => {
        it('debería guardar la configuración correctamente', () => {
            const config = {
                search: {
                    ontologyMode: 'multi_match',
                    dbMode: 'sql'
                }
            };

            storage.saveConfig(config);
            const savedConfig = JSON.parse(localStorage.getItem('searchConfig'));
            expect(savedConfig).to.deep.equal(config);
        });
    });

    describe('getConfig', () => {
        it('debería obtener la configuración guardada', () => {
            const config = {
                search: {
                    ontologyMode: 'openai',
                    dbMode: 'elastic'
                }
            };

            localStorage.setItem('searchConfig', JSON.stringify(config));
            const retrievedConfig = storage.getConfig();
            expect(retrievedConfig).to.deep.equal(config);
        });

        it('debería retornar null si no hay configuración', () => {
            const config = storage.getConfig();
            expect(config).to.be.null;
        });
    });
}); 