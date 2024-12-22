import websockets
import asyncio
import json

async def main():
    uri = "ws://localhost:5001/socket.io/?EIO=4&transport=websocket"
    
    async with websockets.connect(uri) as websocket:
        print("🔌 Conectado al servidor")
        
        # Recibir mensaje de apertura
        response = await websocket.recv()
        print(f"📬 Mensaje de apertura: {response}")
        
        # Enviar mensaje de conexión
        await websocket.send("40")
        
        # Recibir respuesta de conexión
        response = await websocket.recv()
        print(f"📬 Respuesta de conexión: {response}")
        
        # Enviar ping para mantener la conexión
        await websocket.send("2")
        
        # Solicitar tablas
        print("\n📋 Solicitando tablas disponibles...")
        await websocket.send('42["storage.get_tables"]')
        
        # Esperar y procesar respuestas
        try:
            while True:
                response = await websocket.recv()
                
                # Ignorar mensajes de ping/pong
                if response in ["2", "3"]:
                    continue
                    
                # Procesar mensajes de datos
                if response.startswith('42'):
                    try:
                        data = json.loads(response[2:])
                        if isinstance(data, list) and len(data) > 1:
                            event = data[0]
                            payload = data[1]
                            
                            if event == "storage.tables_received":
                                print(f"\n📋 Tablas disponibles: {json.dumps(payload, indent=2)}")
                                break
                    except json.JSONDecodeError:
                        print(f"❌ Error decodificando JSON: {response}")
                        continue
                
        except websockets.exceptions.ConnectionClosed:
            print("❌ Conexión cerrada")
            return
            
        # Enviar ping para mantener la conexión
        await websocket.send("2")
        
        # Solicitar configuración
        print("\n⚙️ Solicitando configuración...")
        await websocket.send('42["storage.get_value",{"key":"searchConfig"}]')
        
        # Esperar y procesar respuestas
        try:
            while True:
                response = await websocket.recv()
                
                # Ignorar mensajes de ping/pong
                if response in ["2", "3"]:
                    continue
                    
                # Procesar mensajes de datos
                if response.startswith('42'):
                    try:
                        data = json.loads(response[2:])
                        if isinstance(data, list) and len(data) > 1:
                            event = data[0]
                            payload = data[1]
                            
                            if event == "storage.value":
                                print(f"\n⚙️ Configuración: {json.dumps(payload, indent=2)}")
                                break
                    except json.JSONDecodeError:
                        print(f"❌ Error decodificando JSON: {response}")
                        continue
                
        except websockets.exceptions.ConnectionClosed:
            print("❌ Conexión cerrada")
            return
        
        print("\n✅ Prueba completada")

if __name__ == "__main__":
    asyncio.run(main()) 