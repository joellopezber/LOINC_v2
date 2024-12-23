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
                'ontologyMode': 'openai',
                'dbMode': 'sql',
                'openai': {
                    'useOriginalTerm': True,
                    'useEnglishTerm': False,
                    'useRelatedTerms': False,
                    'useTestTypes': False,
                    'useLoincCodes': False,
                    'useKeywords': False
                }
            },
            'sql': {
                'maxTotal': 150,
                'maxPerKeyword': 10,
                'maxKeywords': 10,
                'strictMode': True
            },
            'elastic': {
                'limits': {
                    'maxTotal': 50,
                    'maxPerKeyword': 20
                },
                'searchTypes': {
                    'exact': {
                        'enabled': True,
                        'priority': 10
                    },
                    'fuzzy': {
                        'enabled': True,
                        'tolerance': 2
                    },
                    'smart': {
                        'enabled': True,
                        'precision': 7
                    }
                },
                'showAdvanced': False
            },
            'performance': {
                'maxCacheSize': 100,
                'cacheExpiry': 24
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