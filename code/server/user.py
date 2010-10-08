class User:
    def __init__(self, socket, user_id):
        self.user_id = user_id
        self.socket = socket
        self.nick = None
        self.color = None
        self.is_super = False
