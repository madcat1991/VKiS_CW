# coding: utf-8
import socket
import threading
import wsthread
from user import User
import random
import datetime
import shelve

LAST_N_MESSAGES_MAX_COUNT = 5

class WebSocket():

    uid=0
    server=0

    def save_last_message(self, datagram):
        """ сохранение последнего полученного сообщения в N последних """
        self.last_n_messages.append({'sender': datagram['sender'], 'value': datagram['value'], 'time': datetime.datetime.now().strftime('%H:%M:%S')})
        if len(self.last_n_messages) > LAST_N_MESSAGES_MAX_COUNT:
            self.last_n_messages = self.last_n_messages[1:]

    def save_chat_log(self, log_message):
        """ Логирование происходящих серверных изменений(кроме roommates)  """
        self.chat_log_file.write(log_message.encode('utf-8'))
        self.chat_log_file.flush()
        
    def register_new_user(self, nick, password):
        """ Регистрация нового пользователя """
        # TODO : выбрать цвет
        is_super = (nick == 'Admin')
        color = '#FF0000'
        record = {'nick': nick, 'password': password, 'color': color, 'is_super': is_super}
        
        str_nick = nick.encode('utf-8') # shelve requires byte-strings as keys
        self.registered_users[str_nick] = record
        self.registered_users.sync() # flush
    
    def is_user_on_server(self, nick):
        """ Проверка, подключен ли nick к серверу """
        for user in self.users:
            if user.nick == nick:
                return True
        return False

    def __init__(self, address, port, connections, server):
        #последние N сообщений
        self.last_n_messages = []
        self.public_picture_history = []
        
        #пользователи
        self.users=[]
        self.chat_log_file = open('chat_log.log', 'ab')
        
        self.registered_users = shelve.open('users.db')
        for reg_user in self.registered_users:
            print self.registered_users[reg_user]
        
        self.server = server
        server = socket.socket ( socket.AF_INET, socket.SOCK_STREAM )
        server.bind ( ( address, port ) )
        
        # поток с отладчиком, которому доступен экземпляр WebSocket под именем wsk
        def run(wsk):
            import pdb
            pdb.set_trace()
        debug_thread = threading.Thread(target=run, args=(self,))
        debug_thread.start()
        
        server.listen ( connections )
        print "Yo, server here"
        while True:
            channel, details = server.accept()
            print "Wassup?" + str(details)
            self.uid = self.uid + 1
            self.users.append(User(channel, self.uid))
            print "Now starting the thread"
            wsthread.WebSocketThread (channel, details, self).start()