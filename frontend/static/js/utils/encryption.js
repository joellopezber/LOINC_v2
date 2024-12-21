class EncryptionService {
    constructor() {
        // Usamos una clave derivada del user agent y timestamp de instalación
        this.key = this.generateKey();
    }

    generateKey() {
        const baseKey = navigator.userAgent + (localStorage.getItem('installTimestamp') || Date.now());
        return Array.from(
            new Uint8Array(
                new TextEncoder().encode(baseKey)
            )
        ).slice(0, 32).join(',');
    }

    async encrypt(text) {
        try {
            const textEncoder = new TextEncoder();
            const encodedText = textEncoder.encode(text);
            
            const key = await crypto.subtle.importKey(
                'raw',
                new Uint8Array(this.key.split(',')),
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );
            
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedContent = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encodedText
            );

            const encryptedArray = new Uint8Array(encryptedContent);
            const base64Encrypted = btoa(String.fromCharCode(...encryptedArray));
            const base64Iv = btoa(String.fromCharCode(...iv));
            
            return `${base64Encrypted}|${base64Iv}`;
        } catch (error) {
            console.error('Error en encriptación:', error);
            return null;
        }
    }

    async decrypt(encryptedData) {
        try {
            const [encryptedText, iv] = encryptedData.split('|');
            // Conversión más segura de base64 a Uint8Array
            const encryptedArray = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
            const ivArray = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

            const key = await crypto.subtle.importKey(
                'raw',
                new Uint8Array(this.key.split(',')),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            const decryptedContent = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: ivArray
                },
                key,
                encryptedArray
            );

            return new TextDecoder().decode(decryptedContent);
        } catch (error) {
            console.error('Error en desencriptación:', error);
            return null;
        }
    }
}

export const encryption = new EncryptionService(); 