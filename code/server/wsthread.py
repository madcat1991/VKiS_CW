import threading
import hashlib
import socket
import datetime
import re
import json

from utils import Util


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
        
        self.websocket.save_chat_log( u"%s\t%s\t%s\t%s\n" 
            % ( datetime.datetime.now(), self.details, self.this_user.nick, "connected" ))

        
        while True:
            connection_lives = self.interact(self.channel)
            if not connection_lives:
                break
                
        self.websocket.save_chat_log( u"%s\t%s\t%s\t%s\n" 
            % ( datetime.datetime.now(), self.details, self.this_user.nick, "disconnected" ))

        # удаляем из списка юзеров
        #LOCK
        self.websocket.users.remove(self.this_user)
        

    def finduser(self, client):
        for user in self.websocket.users:
            if user.socket == client:
                return user
        return 0
        
    def get_users_list(self):
        result = []
        for user in self.websocket.users:
            result.append({'nick': user.nick, 'color': user.color})
        return result

    def send_data(self, client, str):
        str = b"\x00" + str.encode('utf-8') + b"\xff"
        try:
            #LOCK
            rst = client.send(str)
            return rst
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
                
    
    def broadcast(self, datagram, except_user=None):
        """ отправка датаграммы всем-всем-всем участникам чата"""
        data = json.dumps(datagram)
        for user in self.websocket.users:
            if user.nick is not None:
                if user != except_user:
                    self.send_data(user.socket, data)
            
    def send_private(self, datagram, user):
        """ отправка датаграммы отдельному пользователю(user) """
        data = json.dumps(datagram)
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
            
        #print data
        
        try:
            datagram = json.loads(data)
            if datagram['type'] != 'roommates': 
                log_entry = u"%s\t%s\t%s\t%s\n" % ( datetime.datetime.now(), self.details, this_user.nick, datagram )
                self.websocket.save_chat_log( log_entry )
        except Exception as e:
            import pdb; pdb.set_trace();
        
        if datagram['type'] == 'text':          #M1  
            datagram['sender'] = this_user.nick
            self.websocket.save_last_message(datagram)
            self.broadcast(datagram)
            
        elif datagram['type'] == 'login':       #M10
            str_nick = datagram['nick'].encode('utf-8') # shelve requires byte-strings as keys
            
            if str_nick in self.websocket.registered_users:
                new_user_registered = False
                user_already_on_server = self.websocket.is_user_on_server(datagram['nick'])
                password_correct = (self.websocket.registered_users[str_nick]['password'] == datagram['password'])
            else:
                self.websocket.register_new_user(datagram['nick'], datagram['password'],Util.get_random_rgb_color_string())
                new_user_registered = True
                password_correct = True
                user_already_on_server = False
                
            successfull_login = password_correct and not user_already_on_server
            
            if successfull_login:
                # приветствуем нового участника!
                self.send_private( {'type': 'login_result', 'logged_in': True, 'color': self.websocket.registered_users[str_nick]['color']}, this_user) # M11
                
                this_user.is_super = self.websocket.registered_users[str_nick]['is_super']
                this_user.color = self.websocket.registered_users[str_nick]['color']
                
                this_user.nick = datagram['nick']
                self.broadcast({'type': 'notify', 'subtype': 'user_joined', 'user': datagram['nick']})
                #отправка последних N сообщений новому пользователю
                if self.websocket.last_n_messages != []:
                    self.send_private({'type': 'notify', 'subtype': 'last_messages', 'messages': self.websocket.last_n_messages}, this_user)
                # отправка истории рисования на публичной доске
                self.send_private({'type': 'public_drawing', 'commands': self.websocket.public_picture_history}, this_user)
                if new_user_registered:
                    self.send_private({'type': 'text', 'sender': 'Сообщение от сервера',
                        'value': 'Вы были зарегистрированы как новый пользователь чата. Запомните введенный вами пароль.'},
                        this_user)
            elif not password_correct:
                self.send_private( {'type': 'login_result', 'logged_in': False, 'message': 'Неверный пароль'}, this_user) # M11
                return False # разрываем связь
            elif user_already_on_server:
                self.send_private( {'type': 'login_result', 'logged_in': False, 'message': 'Юзер уже есть на сервере'}, this_user) # M11
                return False # разрываем связь
            else:
                self.send_private( {'type': 'login_result', 'logged_in': False, 'message': 'Что-то еще пошло не так'}, this_user) # M11
                return False # разрываем связь
                
        elif datagram['type'] == 'set-name':    #M4 
            if this_user.nick is not None:
                old_nick = this_user.nick
                this_user.nick = datagram['new_name']
                self.broadcast(
                    {
                        'type': 'notify',
                        'subtype': 'user_renamed',
                        'new_nick': datagram['new_name'],
                        'old_nick': old_nick 
                    }
                )
        elif datagram['type'] == 'public_drawing': #M7
            datagram['sender'] = this_user.nick
            
            #LOCK
            if ('clearall' in datagram['commands']) and this_user.is_super :
                self.websocket.public_picture_history = []
                self.broadcast(datagram)
            elif 'clearall' not in datagram['commands']:
                print datagram
                self.websocket.public_picture_history.extend(datagram['commands'])
                self.broadcast(datagram, except_user=this_user)

        elif datagram['type'] == 'roommates': #M5
            datagram['list'] = self.get_users_list()
            self.send_private(datagram, this_user)
        return True
      
    def check_user_nick_exist(self, user_nick):
        """ проверка отсутствия такого ника у пользователя """
        for chat_user in self.websocket.users:
            if chat_user.nick == user_nick:
                return 0
        return 1