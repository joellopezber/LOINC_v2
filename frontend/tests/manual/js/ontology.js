export class OntologyTester {
    constructor() {
        console.log('🔄 Inicializando OntologyTester');
        this.socket = null;
        this.isConnected = false;
        this.service = null;  // Se inicializará después de la conexión
        this.unsubscribe = null;
        this.onConnectionChange = null;
        this.onSearchResult = null;
        this.onError = null;
    }

    async connect() {
        try {
            if (this.socket?.connected) {
                console.log('🔌 Ya conectado al servidor');
                return;
            }

            console.log('🔌 Conectando al servidor...');
            this.socket = io('http://localhost:5001', {
                transports: ['websocket']
            });

            // Asignar socket a window para que otros servicios lo usen
            window.socket = this.socket;

            this.socket.on('connect', () => {
                console.log('✅ Conectado al servidor');
                this.isConnected = true;
                this.onConnectionChange?.(true);
                this.initialize();  // Inicializar service después de conectar
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Desconectado del servidor');
                this.isConnected = false;
                this.onConnectionChange?.(false);
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ Error de conexión:', error);
                this.isConnected = false;
                this.onConnectionChange?.(false);
            });

        } catch (error) {
            console.error('❌ Error estableciendo conexión:', error);
            this.onError?.(error);
        }
    }

    async initialize() {
        try {
            console.log('🔄 Iniciando inicialización del tester');
            
            // Importar dinámicamente el servicio con la ruta correcta
            const { ontologyService } = await import('/static/js/services/ontology.service.js');
            this.service = ontologyService;

            // Suscribirse a actualizaciones
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

    disconnect() {
        console.log('🧹 Tester: Limpiando recursos');
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.service = null;
    }
} 