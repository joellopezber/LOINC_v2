class EncryptionService {
    constructor() {
        this.MASTER_KEY_SIZE = 32; // 256 bits
        this.initialized = false;
        this.initialize();
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
            let masterKey = localStorage.getItem('masterKey');
            if (!masterKey) {
                const keyBuffer = crypto.getRandomValues(new Uint8Array(this.MASTER_KEY_SIZE));
                masterKey = Array.from(keyBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
                localStorage.setItem('masterKey', masterKey);
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
        } catch (error) {
            console.error('[Encryption] Error crítico inicializando el servicio:', error);
            throw error;
        }
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