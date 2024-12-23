class EncryptionService {
    constructor() {
        this.MASTER_KEY_SIZE = 32; // 256 bits
        this.initialized = false;
        this.masterKeyPromise = null;
        this.initializationAttempted = false;
    }

    // Función auxiliar para convertir ArrayBuffer a Base64 de forma segura
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000; // Procesar en chunks para evitar stack overflow
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        
        return btoa(binary);
    }

    // Función auxiliar para convertir Base64 a ArrayBuffer de forma segura
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        return bytes.buffer;
    }

    async initialize() {
        try {
            // Si ya está inicializado o se intentó inicializar, retornar
            if (this.initialized || this.initializationAttempted) {
                console.debug('[Encryption] Ya inicializado o intentado');
                return;
            }

            // Si ya hay una inicialización en progreso, esperar
            if (this.masterKeyPromise) {
                console.debug('[Encryption] Esperando inicialización en progreso...');
                await this.masterKeyPromise;
                return;
            }

            this.initializationAttempted = true;

            // Crear una promesa para la inicialización
            this.masterKeyPromise = new Promise(async (resolve, reject) => {
                try {
                    console.log('[Encryption] Inicializando servicio...');
                    
                    // Esperar a que el WebSocket esté disponible
                    await this._waitForWebSocket();
                    
                    // Obtener la master key del backend
                    let masterKey = null;
                    if (window.socket?.connected) {
                        console.log('[Encryption] Solicitando master key al servidor...');
                        window.socket.emit('encryption.get_master_key');
                        
                        masterKey = await new Promise((resolveKey) => {
                            const timeoutId = setTimeout(() => {
                                window.socket.off('encryption.master_key');
                                console.warn('[Encryption] Timeout esperando master key del servidor');
                                resolveKey(null);
                            }, 5000);

                            window.socket.once('encryption.master_key', (data) => {
                                clearTimeout(timeoutId);
                                console.log('[Encryption] Master key recibida del servidor');
                                resolveKey(data.key);
                            });
                        });
                    }

                    // Si no se pudo obtener la master key del backend, error
                    if (!masterKey) {
                        throw new Error('No se pudo obtener la master key del servidor');
                    }
                    
                    const keyBuffer = new Uint8Array(masterKey.match(/.{2}/g).map(byte => parseInt(byte, 16)));
                    this.masterKey = await crypto.subtle.importKey(
                        'raw',
                        keyBuffer,
                        { name: 'HKDF' },
                        false,
                        ['deriveKey']
                    );
                    
                    this.initialized = true;
                    console.log('[Encryption] Servicio inicializado correctamente');
                    resolve();
                } catch (error) {
                    console.error('[Encryption] Error crítico inicializando el servicio:', error);
                    reject(error);
                } finally {
                    this.masterKeyPromise = null;
                }
            });

            await this.masterKeyPromise;
        } catch (error) {
            console.error('[Encryption] Error en initialize:', error);
            throw error;
        }
    }

    async _waitForWebSocket() {
        if (window.socket?.connected) {
            return;
        }

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (window.socket?.connected) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Timeout después de 5 segundos
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 5000);
        });
    }

    async deriveKey(salt) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        return await crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: salt,
                info: new Uint8Array([])
            },
            this.masterKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async encrypt(text) {
        try {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const key = await this.deriveKey(salt);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encryptedContent = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                new TextEncoder().encode(text)
            );

            const result = new Uint8Array(salt.length + iv.length + encryptedContent.byteLength);
            result.set(salt, 0);
            result.set(iv, salt.length);
            result.set(new Uint8Array(encryptedContent), salt.length + iv.length);

            return this.arrayBufferToBase64(result.buffer);
        } catch (error) {
            console.error('[Encryption] Error crítico en encriptación:', error);
            return null;
        }
    }

    async decrypt(encryptedData) {
        try {
            const data = new Uint8Array(this.base64ToArrayBuffer(encryptedData));
            
            const salt = data.slice(0, 16);
            const iv = data.slice(16, 28);
            const content = data.slice(28);

            const key = await this.deriveKey(salt);

            const decryptedContent = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                content
            );

            return new TextDecoder().decode(decryptedContent);
        } catch (error) {
            console.error('[Encryption] Error crítico en desencriptación:', error);
            return null;
        }
    }
}

export const encryption = new EncryptionService(); 