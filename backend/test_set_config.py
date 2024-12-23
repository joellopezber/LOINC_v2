from socketio import Client
import json

sio = Client(ssl_verify=False)

@sio.event
def connect():
    print('🔌 Conectado')
    sio.emit('storage.set_value', {
        'key': 'searchConfig',
        'value': {
            'search': {
                'ontologyMode': 'multi_match',
                'dbMode': 'elastic'
            },
            'elastic': {
                'limits': {
                    'maxTotal': 100,
                    'maxPerKeyword': 10
                }
            }
        }
    })

@sio.event
def storage_value_set(data):
    print('✅ Valor guardado:', json.dumps(data, indent=2))
    print('👋 Cerrando conexión...')
    sio.disconnect()
    print('✨ Conexión cerrada')

@sio.event
def disconnect():
    print('❌ Desconectado del servidor')
    exit(0)  # Aseguramos que el script termine

try:
    sio.connect('http://localhost:5001', transports=['websocket'])
    sio.wait()
except KeyboardInterrupt:
    print('\n🛑 Interrumpido por el usuario')
    sio.disconnect()
    exit(1)
except Exception as e:
    print('❌ Error:', e)
    exit(1) 