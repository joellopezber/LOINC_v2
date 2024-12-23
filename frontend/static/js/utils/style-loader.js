// Ejecutar antes de DOMContentLoaded para prevenir FOUC
(function() {
    // Añadir clase de carga inicial inmediatamente
    document.documentElement.classList.add('styles-loading');
    
    function waitForStylesheets() {
        return new Promise((resolve) => {
            const stylesheets = document.styleSheets;
            
            function checkStylesheets() {
                const allLoaded = Array.from(stylesheets).every(sheet => {
                    try {
                        return sheet.cssRules && sheet.cssRules.length > 0;
                    } catch (e) {
                        return false;
                    }
                });

                if (allLoaded) {
                    resolve();
                } else {
                    requestAnimationFrame(checkStylesheets);
                }
            }

            requestAnimationFrame(checkStylesheets);
        });
    }

    // Timeout de seguridad más corto
    const safetyTimeout = setTimeout(() => {
        document.documentElement.classList.remove('styles-loading');
        document.documentElement.classList.add('styles-loaded');
    }, 1000);

    // Esperar a que las hojas de estilo se carguen
    waitForStylesheets()
        .then(() => {
            clearTimeout(safetyTimeout);
            requestAnimationFrame(() => {
                document.documentElement.classList.remove('styles-loading');
                document.documentElement.classList.add('styles-loaded');
            });
        })
        .catch(() => {
            clearTimeout(safetyTimeout);
            document.documentElement.classList.remove('styles-loading');
            document.documentElement.classList.add('styles-loaded');
        });
})(); 