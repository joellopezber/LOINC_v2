import { websocketService } from '../services/websocket.service.js';

class EncryptionService {
    constructor() {
        this.MASTER_KEY_SIZE = 32; // 256 bits
        this.initialized = false;
        this.masterKeyPromise = null;
        this.initializationAttempted = false;
        this._migrateFromLocalStorage(); // Migración suave desde localStorage
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

    async _migrateFromLocalStorage() {
        const oldKey = localStorage.getItem('masterKey');
        if (oldKey) {
            this._temporaryKey = oldKey;
        }
    }

    async initialize() {
        const startTime = performance.now();
        try {
            if (this.initialized || this.initializationAttempted) {
                return;
            }

            if (this.masterKeyPromise) {
                await this.masterKeyPromise;
                return;
            }

            this.initializationAttempted = true;

            this.masterKeyPromise = new Promise(async (resolve, reject) => {
                try { 
                    await this._waitForWebSocket();
                    
                    let masterKey = null;
                    if (websocketService.isConnected()) {
                        const installTimestamp = localStorage.getItem('installTimestamp');
                        if (!installTimestamp) {
                            reject(new Error('No hay installTimestamp disponible'));
                            return;
                        }

                        try {
                            const response = await websocketService.sendRequest('encryption.get_master_key', {
                                installTimestamp
                            });
                            
                            if (response.status === 'success' && response.key) {
                                masterKey = response.key;
                                console.log('🔑 MasterKey recibida del servidor');
                            } else {
                                console.error('[Encryption] Error:', response.message);
                            }
                        } catch (error) {
                            console.error('[Encryption] Error:', error);
                        }
                    }

                    if (!masterKey && this._temporaryKey) {
                        masterKey = this._temporaryKey;
                        console.log('🔑 Usando MasterKey temporal');
                        delete this._temporaryKey;
                    }

                    if (!masterKey) {
                        throw new Error('No se pudo obtener la master key');
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
                    console.log('✅ EncryptionService inicializado');

                    if (localStorage.getItem('masterKey')) {
                        localStorage.removeItem('masterKey');
                    }

                    resolve();
                } catch (error) {
                    console.error('[Encryption] Error crítico:', error);
                    reject(error);
                } finally {
                    this.masterKeyPromise = null;
                }
            });

            await this.masterKeyPromise;
        } catch (error) {
            console.error('[Encryption] Error:', error);
            throw error;
        }
    }

    async _waitForWebSocket() {
        if (websocketService.isConnected()) {
            return;
        }

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (websocketService.isConnected()) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 10);

            // Timeout después de 1 segundo
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 1000);
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
            console.error('[Encryption] Error encriptando:', error);
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

            const result = new TextDecoder().decode(decryptedContent);
            console.log('🔓 Datos desencriptados correctamente');
            return result;
        } catch (error) {
            console.error('[Encryption] Error desencriptando:', error);
            return null;
        }
    }
}

export const encryption = new EncryptionService(); 