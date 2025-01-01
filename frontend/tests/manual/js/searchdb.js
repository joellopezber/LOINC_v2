import { BaseTester } from './base.js';

export class SearchDBTester extends BaseTester {
    constructor() {
        super();
        console.log('🏗️ Inicializando SearchDBTester');
        this.onSearchResult = null;
    }

    async initialize() {
        // Configurar listeners específicos
        this._ws.on('search_result', (data) => {
            console.log('📩 Resultado de búsqueda recibido:', {
                timestamp: new Date().toISOString(),
                data: JSON.stringify(data, null, 2)
            });
            this.onSearchResult?.(data);
        });

        // Monitorizar todos los eventos
        this._ws.onAny((eventName, ...args) => {
            console.log('🎯 Evento recibido:', {
                timestamp: new Date().toISOString(),
                event: eventName,
                args: args
            });
        });
    }

    async search(query) {
        if (!this.isConnected) {
            console.error('❌ Intento de búsqueda sin conexión');
            throw new Error('No hay conexión con el servidor');
        }

        const searchData = {
            query,
            user_id: this._ws.getSocketId(),
            timestamp: new Date().toISOString()
        };

        console.log('🔍 Iniciando búsqueda:', searchData);

        return new Promise((resolve, reject) => {
            console.log('📤 Emitiendo evento search');
            this._ws.sendRequest('search', searchData).then(response => {
                console.log('📩 Respuesta recibida:', {
                    timestamp: new Date().toISOString(),
                    status: response?.status,
                    response: JSON.stringify(response, null, 2)
                });

                if (response?.status === 'success') {
                    console.log('✅ Búsqueda exitosa');
                    this.onSearchResult?.(response);
                    resolve(response);
                } else {
                    console.error('❌ Error en búsqueda:', response?.message || 'Error desconocido');
                    const error = new Error(response?.message || 'Error desconocido');
                    this.onError?.(error);
                    reject(error);
                }
            }).catch(error => {
                console.error('❌ Error en búsqueda:', error);
                this.onError?.(error);
                reject(error);
            });
        });
    }

    setPreferredService(service) {
        if (!this.isConnected) {
            console.error('❌ Intento de configuración sin conexión');
            throw new Error('No hay conexión con el servidor');
        }

        console.log('⚙️ Configurando servicio:', {
            timestamp: new Date().toISOString(),
            service: service,
            socketId: this._ws.getSocketId()
        });

        return new Promise((resolve, reject) => {
            console.log('📤 Emitiendo evento set_preferred_service');
            this._ws.sendRequest('set_preferred_service', { service }).then(response => {
                console.log('📩 Respuesta de configuración:', {
                    timestamp: new Date().toISOString(),
                    status: response?.status,
                    response: JSON.stringify(response, null, 2)
                });

                if (response?.status === 'success') {
                    console.log('✅ Configuración exitosa');
                    resolve(response);
                } else {
                    console.error('❌ Error en configuración:', response?.message || 'Error al configurar servicio');
                    const error = new Error(response?.message || 'Error al configurar servicio');
                    this.onError?.(error);
                    reject(error);
                }
            }).catch(error => {
                console.error('❌ Error en configuración:', error);
                this.onError?.(error);
                reject(error);
            });
        });
    }
} 