# coding: utf-8
import socket
import wsthread
import user
import random
import datetime

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
        self.chat_log_file.write(log_message)
        self.chat_log_file.flush()

    def __init__(self, address, port, connections, server):
        #последние N сообщение
        self.last_n_messages = []
        self.public_picture_history = []
        
        #пользователи
        self.users=[]
        self.chat_log_file = open('chat_log.log', 'a')
        
        self.server = server
        server = socket.socket ( socket.AF_INET, socket.SOCK_STREAM )
        server.bind ( ( address, port ) )
        
        server.listen ( connections )
        print "Yo, server here"
        while True:
            channel, details = server.accept()
            print "Wassup?" + str(details)
            self.uid = self.uid + 1
            self.users.append(user.user(channel, self.uid))
            print "Now starting the thread"
            wsthread.WebSocketThread (channel, details, self).start()