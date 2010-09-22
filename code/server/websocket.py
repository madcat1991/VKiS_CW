# coding: utf-8
import socket
import wsthread
import user
import random
import datetime

LAST_N_MESSAGES_MAX_COUNT = 10

class WebSocket():

    uid=0
    users=[]
    server=0

    def saveLastMessage(self, datagram):
        """ сохранение последнего полученного сообщения в N последних """
        self.lastNMessages.append({'sender': datagram['sender'], 'value': datagram['value'], 'time': datetime.datetime.now().strftime('%H:%M:%S')})
        if len(self.lastNMessages) > LAST_N_MESSAGES_MAX_COUNT:
            self.lastNMessages = self.lastNMessages[1:]

    
    def __init__(self, address, port, connections, server):
        #последние N сообщение
        self.lastNMessages = []
        
        self.server = server
        server = socket.socket ( socket.AF_INET, socket.SOCK_STREAM )
        server.bind ( ( address, port ) )
        #server.bind(address + ":" + str(port))
        server.listen ( connections )
        print "Yo, server here"
        while True:
            channel, details = server.accept()
            print "Wassup?" + str(details)
            self.uid = self.uid + 1
            self.users.append(user.user(channel, self.uid))
            print "Now starting the thread"
            wsthread.WebSocketThread (channel, details, self).start()