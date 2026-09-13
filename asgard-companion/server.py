"""Loopback WebSocket controls with authentication before every capability."""
import asyncio
import hmac
import json
import logging
import websockets
class Server:
    def __init__(self,app):self.app=app;self.clients=set();self.loop=None
    async def handler(self,ws):
        origin=ws.request.headers.get('Origin')
        if origin and not origin.startswith('chrome-extension://'):
            await ws.close(4403,'Origin refused');return
        try:
            hello=json.loads(await asyncio.wait_for(ws.recv(),3))
            if not hmac.compare_digest(str(hello.get('token','')),self.app.config.secrets['local_token']):
                await ws.close(4401,'Authentication required');return
            self.clients.add(ws)
            await ws.send(json.dumps({'type':'state',**self.app.status()}))
            async for raw in ws:
                data=json.loads(raw);op=data.get('op');result={}
                try:
                    if op=='status':result=await asyncio.to_thread(self.app.diagnostics)
                    elif op in ('mute','unmute'):self.app.mute(op=='mute');result=self.app.status()
                    elif op=='settings':
                        changes=data.get('settings',{})
                        if set(changes)-{'clip_seconds','sensitivity','command_window'}:raise ValueError('Invalid settings')
                        self.app.config.validate(changes)
                        if 'clip_seconds' in changes:await asyncio.to_thread(self.app.obs.set_seconds,changes['clip_seconds'])
                        self.app.config.save(changes);self.app.reload_wake=True;result=self.app.config.data
                    elif op=='clip':result=await asyncio.to_thread(self.app.obs.clip)
                    elif op=='chime':await asyncio.to_thread(self.app.speaker.chime,self.app.god)
                    elif op=='voice':await asyncio.to_thread(self.app.speaker.say,self.app.god,'Here, sir.' if self.app.god=='thor' else 'Here.')
                    elif op=='worker':result=await asyncio.to_thread(self.app.brain.health);self.app.health('worker',None)
                    else:raise ValueError('Unknown operation')
                    await ws.send(json.dumps({'id':data.get('id'),'ok':True,'result':result}))
                except Exception as e:
                    logging.warning('Control operation %s failed: %s',op,type(e).__name__)
                    await ws.send(json.dumps({'id':data.get('id'),'ok':False,'error':str(e)[:180]}))
        except (websockets.ConnectionClosed,TimeoutError,ValueError):pass
        finally:self.clients.discard(ws)
    async def serve(self):
        self.loop=asyncio.get_running_loop()
        for port in range(47321,47331):
            try:
                server=await websockets.serve(self.handler,'127.0.0.1',port,max_size=8192,ping_interval=None)
                self.app.config.save({'port':port});break
            except OSError:continue
        else:raise RuntimeError('No local WebSocket port available')
        self.app.health('server',None)
        async with server:await asyncio.Future()
    def run(self):asyncio.run(self.serve())
    def push(self,data):
        if self.loop:
            async def send():
                for ws in tuple(self.clients):
                    try:await ws.send(json.dumps({'type':'state',**data}))
                    except websockets.ConnectionClosed:self.clients.discard(ws)
            asyncio.run_coroutine_threadsafe(send(),self.loop)
