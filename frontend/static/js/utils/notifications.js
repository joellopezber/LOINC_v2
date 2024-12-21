class NotificationService {
    constructor() {
        this.container = this.createContainer();
    }

    createContainer() {
        const container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
        return container;
    }

    show(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icon = document.createElement('span');
        icon.className = 'notification-icon';
        switch (type) {
            case 'success':
                icon.textContent = '✓';
                break;
            case 'error':
                icon.textContent = '✕';
                break;
            case 'warning':
                icon.textContent = '!';
                break;
            default:
                icon.textContent = 'i';
        }
        
        const text = document.createElement('span');
        text.className = 'notification-text';
        text.textContent = message;
        
        notification.appendChild(icon);
        notification.appendChild(text);
        this.container.appendChild(notification);

        // Animación de entrada
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Animación de salida y eliminación
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
    }

    success(message, duration = 3000) {
        this.show(message, 'success', duration);
    }

    error(message, duration = 3000) {
        this.show(message, 'error', duration);
    }

    warning(message, duration = 3000) {
        this.show(message, 'warning', duration);
    }

    info(message, duration = 3000) {
        this.show(message, 'info', duration);
    }
}

export const notifications = new NotificationService(); 