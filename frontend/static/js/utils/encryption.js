class EncryptionService {
    constructor() {
        this.MASTER_KEY_SIZE = 32; // 256 bits
        this.initialized = false;
        console.log('[Encryption] Inicializando servicio de encriptación...');
        this.initialize();
    }

    async initialize() {
        try {
            let masterKey = localStorage.getItem('masterKey');
            if (!masterKey) {
                console.log('[Encryption] Generando nueva clave maestra...');
                const keyBuffer = crypto.getRandomValues(new Uint8Array(this.MASTER_KEY_SIZE));
                masterKey = Array.from(keyBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
                localStorage.setItem('masterKey', masterKey);
            }
            
            console.log('[Encryption] Importando clave maestra...');
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
        } catch (error) {
            console.error('[Encryption] Error inicializando el servicio:', error);
            throw error;
        }
    }

    async deriveKey(salt) {
        if (!this.initialized) {
            console.log('[Encryption] Servicio no inicializado, inicializando...');
            await this.initialize();
        }
        
        console.log('[Encryption] Derivando clave para encriptación...');
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
            console.log('[Encryption] Iniciando encriptación...');
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const key = await this.deriveKey(new TextDecoder().decode(salt));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            console.log('[Encryption] Encriptando datos...');
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

            console.log('[Encryption] Datos encriptados correctamente');
            return btoa(String.fromCharCode.apply(null, result));
        } catch (error) {
            console.error('[Encryption] Error en encriptación:', error);
            return null;
        }
    }

    async decrypt(encryptedData) {
        try {
            console.log('[Encryption] Iniciando desencriptación...');
            const data = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
            
            // Extraer componentes
            const salt = data.slice(0, 16);
            const iv = data.slice(16, 28);
            const content = data.slice(28);

            console.log('[Encryption] Derivando clave para desencriptación...');
            const key = await this.deriveKey(new TextDecoder().decode(salt));

            console.log('[Encryption] Desencriptando datos...');
            const decryptedContent = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                content
            );

            console.log('[Encryption] Datos desencriptados correctamente');
            return new TextDecoder().decode(decryptedContent);
        } catch (error) {
            console.error('[Encryption] Error en desencriptación:', error);
            return null;
        }
    }
}

export const encryption = new EncryptionService(); 