import socketio
import json
import sys
import time
import os

class TestWebSocket:
    def __init__(self):
        print("\n🔍 Probando conexión con servidor existente en localhost:5001...")
        self.sio = socketio.Client(ssl_verify=False)
        self.connected = False
        self.update_received = False
        self.current_config = None
        self.setup_handlers()
        
    def setup_handlers(self):
        @self.sio.on('connect')
        def on_connect():
            print("✅ Conexión establecida")
            self.connected = True
            
        @self.sio.on('connect_response')
        def on_connect_response(data):
            print("📬 Respuesta del servidor:", json.dumps(data, indent=2))
            
        @self.sio.on('storage.value_updated')
        def on_value_updated(data):
            """Recibe actualización broadcast del servidor"""
            print("\n📥 Actualización broadcast recibida:", json.dumps(data, indent=2))
            self.update_received = True
            
        @self.sio.on('storage_value')
        def on_storage_value(data):
            """Recibe valor actual del storage"""
            print("\n📦 Configuración actual recibida:", json.dumps(data, indent=2))
            if 'value' in data:
                self.current_config = data['value']
                
    def get_current_config(self):
        """Obtiene la configuración actual del servidor"""
        print("\n2️⃣ Obteniendo configuración actual...")
        self.sio.emit('storage.get_value', {
            'key': 'searchConfig',
            'request_id': 'get_config'
        })
        # Esperar a recibir la configuración
        start = time.time()
        while time.time() - start < 5:  # Esperar máximo 5 segundos
            if self.current_config:
                print("✅ Configuración actual obtenida")
                return True
            time.sleep(0.1)
        print("❌ Error: No se pudo obtener la configuración actual")
        return False
                
    def run_test(self):
        try:
            # 1. Conectar al servidor existente
            print("\n1️⃣ Conectando al servidor existente...")
            self.sio.connect('http://localhost:5001', transports=['websocket'])
            time.sleep(1)
            
            if not self.connected:
                print("❌ Error: No se pudo conectar al servidor")
                return False
                
            # 2. Obtener configuración actual
            if not self.get_current_config():
                return False
                
            # 3. Modificar configuración
            print("\n3️⃣ Modificando configuración...")
            if not self.current_config:
                self.current_config = {}
            
            # Asegurarnos que la estructura existe
            if 'search' not in self.current_config:
                self.current_config['search'] = {}
            if 'openai' not in self.current_config['search']:
                self.current_config['search']['openai'] = {}
                
            # Modificar valores específicos
            self.current_config['search'].update({
                'ontologyMode': 'multi_match',
                'dbMode': 'sql'  # Cambio simulado
            })
            self.current_config['search']['openai'].update({
                'useOriginalTerm': True,
                'useEnglishTerm': False,
                'useRelatedTerms': False,
                'useTestTypes': False,
                'useLoincCodes': True,
                'useKeywords': True
            })
            
            # 4. Enviar actualización
            print("\n4️⃣ Enviando actualización al servidor...")
            self.sio.emit('storage.set_value', {
                'key': 'searchConfig',
                'value': self.current_config,
                'request_id': 'test_update'
            })
            
            # 5. Esperar broadcast
            print("\n5️⃣ Esperando broadcast del servidor...")
            start = time.time()
            while time.time() - start < 5:  # Esperar máximo 5 segundos
                if self.update_received:
                    print("✅ Broadcast recibido correctamente")
                    break
                time.sleep(0.1)
            
            if not self.update_received:
                print("❌ Error: No se recibió el broadcast del servidor")
                return False
                
            print("\n✅ Prueba completada exitosamente")
            return True
            
        except Exception as e:
            print(f"❌ Error en la prueba: {e}")
            return False
        finally:
            print("\n👋 Desconectando del servidor...")
            try:
                self.sio.disconnect()
            except:
                pass
            print("✅ Desconectado correctamente")
            
if __name__ == '__main__':
    test = TestWebSocket()
    success = test.run_test()
    sys.exit(0 if success else 1) 