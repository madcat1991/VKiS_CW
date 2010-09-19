import threading
import hashlib
import socket
import time
import re
import json

# штука для преобразования чисел в строку байтов в big-endian
from struct import Struct
big_endian_uint = Struct('>L')

# местные исключения
class ConnectionClosedError(Exception):
    pass
class MalformedPacketError(Exception):
    pass

# поток, общающийся с одним клиентом
class WebSocketThread(threading.Thread):

    def __init__ ( self, channel, details, websocket ):
        print "Thread ctor here=)"
        self.channel = channel
        self.details = details
        self.websocket = websocket
        self.this_user = self.finduser(self.channel)
        threading.Thread.__init__ ( self )

    def run ( self ):
        print ("Received connection ", self.details [ 0 ])
        self.handshake(self.channel)
        
        #self.broadcast({'type': 'notify', 'subtype': 'user_joined', 'user': str(self.this_user.nick)})
        # сейчас делается при обработке первого сообщения М4 от этого пользователя
        
        while True:
            connection_lives = self.interact(self.channel)
            if not connection_lives:
                break
                
        # удаляем из списка юзеров
        # надо бы lock(self.websocket.users), но я не умею)))
        self.websocket.users.remove(self.this_user)

    def finduser(self, client):
        for user in self.websocket.users:
            if user.socket == client:
                return user
        return 0

    def send_data(self, client, str):
        str = b"\x00" + str.encode('utf-8') + b"\xff"
        try:
            return client.send(str)
        except IOError as e:
            if e.errno == 10053:
                print "Stupid error 10053"
                return
            import pdb; pdb.set_trace()
            if e.errno == 32:
                user = self.finduser(client)
                print ("pipe error")

    def recv_data(self, client, count):
        data = client.recv(count)
        return data.decode('utf-8', 'ignore')
        #return data

    def get_headers(self, client):
        """ reading request headers """
        got_data = ""
        buf = ""
        while buf != "\r\n\r\n":
            byte = client.recv(1)
            got_data = got_data + byte
            buf = (buf + byte)[-4:]
        lines = [d.strip() for d in got_data.split('\r\n')]
        header_dict = {'<first>': lines[0]}
        for line in lines:
            match = re.match('^([^\:]+)\: (.+)$', line)
            if match is not None: 
                left, right = match.groups()
                header_dict[left.strip()] = right
        return header_dict
        

    def handshake(self, client):
        """ handshake for protocol ver. 75 """
        headers = self.get_headers(client)
        data_8bytes = client.recv(8)
        
        if 'Sec-WebSocket-Key1' not in headers:
            print "Request's protocol is 74"
            # TODO : вообще-то версию 74 тоже надо обрабатывать!
            return
        
        requested_resource = re.match('^GET (.+) HTTP.*$', headers['<first>']).group(1)
        
        def keystr_thingy(keystr):
            key = int(''.join([c for c in keystr if c in '0123456789']))
            spaces_count = len([c for c in keystr if c == ' '])
            some_value = key // spaces_count
            result = big_endian_uint.pack(some_value)
            return result
            
        key1 = keystr_thingy(headers['Sec-WebSocket-Key1'])
        key2 = keystr_thingy(headers['Sec-WebSocket-Key2'])
        big_string = key1 + key2 + data_8bytes
        md5hash = hashlib.md5(big_string).digest()
        
        
        our_handshake = ("HTTP/1.1 101 Web Socket Protocol Handshake\r\n"+
            "Upgrade: WebSocket\r\n"+"Connection: Upgrade\r\n"+
            "Sec-WebSocket-Origin: "+headers['Origin']+"\r\n"+
            "Sec-WebSocket-Protocol: sample\r\n" +
            "Sec-WebSocket-Location: ws://" + headers['Host'] + requested_resource + 
            "\r\n\r\n" + md5hash)
        client.send(our_handshake)

    def recieve_length_prefixed_data(self, client):
        """ чтение из сокета строки данных, префиксированной длиной этой строки.
            возвращает строку данных.
            выбрасывает исключения ConnectionClosedError и MalformedPacketError.
            Более не используется, но выкидывать жалко.
            Да-да, я знаю, что для этого и нужны VCS.
            Да-да, я уже жалею, что выбрал простую общую папку в Dropbox.
        """
        # а может к черту префиксирование длиной? читаем, пока не встретим 0xFF...
        # ага, по одному байту читаем что ли?
        # нужен буфер
        # или пофиг? читаем по одному байту, полагаемся на буфер сокета?
        # и выполняем тысячу конкатенаций на килобайтный пакет?
        data_prefix = self.recv_data(client, 7)[1:] # строка "\x0065536-" влезает в 6 символов.
        if len(data_prefix) == 0:
            raise ConnectionClosedError
        
        try:
            # длина данных идет перед символом "-"
            data_length = int(data_prefix[:data_prefix.find('-')])
        except:
            #import pdb; pdb.set_trace()
            raise MalformedPacketError
        
        data_prefetched = data_prefix[data_prefix.find('-')+1:]
        
        data_rest = self.recv_data(client, data_length + 1) # +1 из-за символа-терминатора WebSockets
        if len(data_rest) == 0:
            raise ConnectionClosedError
        data = data_prefetched + data_rest
        
        return data
        
    def recieve_websocket_string(self, client):
        """ чтение строки, отправленной веб-сокетом (в начале строки 0x00, в конце 0xFF).
            возвращает строку данных без этих ограничителей.
            выбрасывает исключения ConnectionClosedError и MalformedPacketError
        """
        # TODO: нужно что-нить придумать поумнее вместо тупой конкатенации.
        # где мой StringBuilder?
        str = ""
        byte = client.recv(1)
        if byte == "":
            raise ConnectionClosedError
        elif byte != b"\x00":
            raise MalformedPacketError
        
        while True:
            byte = client.recv(1)
            if byte == "":
                raise ConnectionClosedError
            elif byte == b"\xFF":
                break
            str += byte
        return str.decode('utf-8', 'ignore') # я не знаю что значит ignore=)
            
        
    
    def broadcast(self, datagram):
        """ отправка датаграммы всем-всем-всем участникам чата"""
        data = json.dumps(datagram)
        for user in self.websocket.users:
            if user.nick is not None:
                self.send_data(user.socket, data)
    
    def interact(self, client):
        """ цикл общения с клиентом 
            возвращает: True, если общение может продолжаться;
                        False, иначе.
        """
        users = self.websocket.users
        this_user = self.this_user
        
        try:
            data = self.recieve_websocket_string(client)
        except ConnectionClosedError:
            print "//closed: #" + unicode(this_user.nick) + " has left"
            self.broadcast({'type': 'notify', 'subtype': 'user_left', 'user': unicode(this_user.nick)})
            # TODO: broadcast (warning: will probably get err 10053 from
            # this very client
            return False
        except MalformedPacketError:
            print "//malformed packet from #" + unicode(this_user.nick)
            return True
            
        print data
        
        try:
            datagram = json.loads(data)
        except Exception as e:
            import pdb; pdb.set_trace();
        
        if datagram['type'] == 'text':
            datagram['sender'] = this_user.nick
            self.broadcast(datagram)
        elif datagram['type'] == 'set-name':   # M4
            if this_user.nick is None:
                this_user.nick = datagram['new_name']
                self.broadcast({'type': 'notify', 'subtype': 'user_joined', 'user': datagram['new_name']})
            else:
                this_user.nick = datagram['new_name']
                self.broadcast(
					{
						'type': 'notify',
						'subtype': 'user_renamed',
						'user_new_nick': datagram['new_name'],
						'user_old_nick': datagram['old_name']
					}
				)
                
        return True