class EncryptionService {
    constructor() {
        this.MASTER_KEY_SIZE = 32; // 256 bits
        this.initialized = false;
        this.initialize();
    }

    async initialize() {
        try {
            let masterKey = localStorage.getItem('masterKey');
            if (!masterKey) {
                // Generar nueva clave maestra en la instalación
                const keyBuffer = crypto.getRandomValues(new Uint8Array(this.MASTER_KEY_SIZE));
                masterKey = Array.from(keyBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
                localStorage.setItem('masterKey', masterKey);
            }
            // Importar clave maestra
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
            console.error('Error inicializando el servicio de encriptación:', error);
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
                salt: new TextEncoder().encode(salt),
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
            const key = await this.deriveKey(new TextDecoder().decode(salt));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encryptedContent = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                new TextEncoder().encode(text)
            );

            // Combinar salt + iv + contenido encriptado
            const result = new Uint8Array(salt.length + iv.length + encryptedContent.byteLength);
            result.set(salt, 0);
            result.set(iv, salt.length);
            result.set(new Uint8Array(encryptedContent), salt.length + iv.length);

            // Codificar resultado final en base64 seguro
            return btoa(String.fromCharCode.apply(null, result));
        } catch (error) {
            console.error('Error en encriptación:', error);
            return null;
        }
    }

    async decrypt(encryptedData) {
        try {
            // Decodificar datos
            const data = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
            
            // Extraer componentes
            const salt = data.slice(0, 16);
            const iv = data.slice(16, 28);
            const content = data.slice(28);

            // Derivar clave usando el salt original
            const key = await this.deriveKey(new TextDecoder().decode(salt));

            const decryptedContent = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                content
            );

            return new TextDecoder().decode(decryptedContent);
        } catch (error) {
            console.error('Error en desencriptación:', error);
            return null;
        }
    }
}

export const encryption = new EncryptionService(); 