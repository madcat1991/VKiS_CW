//id интервала
var intervalId="";

// настройка сокета
var setup_socket = function() {
    if (!window.WebSocket) {
        document.write("<h1>No websockets for you, sorry</h1>");
        return;
    }
    
    window.ws = new WebSocket("ws://" + server_ip + ":17600");
    //logg('Right after creation, ws.readyState=' + ws.readyState)
    
    ws.onopen = function() {
        logg('Подключение к серверу выполнено.');
        
        ws.onmessage = function (evt) { 
            datagram_recieved(evt.data);
        };
        
         ws.onclose = function() { 
            logg('Сервер разорвал соединение.'); 
            clearInterval(intervalId);
        };
        
        // сообщаем серверу наш ник, чтобы стать участником чата
        // см. описание протокола, М4, пункт 4а 
        if (localStorage.getItem('chat_nick') == null) 
        {
            default_nick = 'Участник #' + (new Date()).getMilliseconds()
            nick = prompt('Введите ваш псевдоним:', default_nick);
            if (nick == null || nick == '') nick = default_nick;
            localStorage.setItem('chat_nick', nick);
        };
        
        window.chat_nick = localStorage.getItem('chat_nick');
        // далее в сессии используем chat_nick, а не localStorage
        $('userNickInfo').innerHTML = "Вас зовут <b>" + chat_nick + 
            "</b> (<a href='#' onclick='renameNickname()'>сменить ник</a>)";
        $('whoIsHere').innerHTML = 
            " <a href='#' onclick='toggle_people_list()'>кто здесь? (<span id='people_count'>0</span>)</a>";            
        send_datagram({'type': 'set-name', 'new_name': chat_nick}); // M4
        
        //обновляем список пользоватлей и запускаем таймер,
        //список так же обнавляется однократно при приходи сообщения типа 'notify'
        intervalId = window.setInterval("updateUserList();",30000);

        $('inputbox').focus();
    };
    //logg('After setting onopen, ws.readyState=' + ws.readyState)
    
    
    //logg('After setting onmessage, ws.readyState=' + ws.readyState)
    
    ws.onclose = function() { 
        logg('Невозможно подключиться к серверу.'); 
        clearInterval(intervalId);
    };
    //logg('After setting onclose, ws.readyState=' + ws.readyState)
    
};

// общение с сервером - уровень пакетов/датаграмм

var datagram_recieved = function (packet) {
    /// я ОЧЕНЬ надеюсь, что packet содержит датаграмму целиком, 
    /// а не первые N байт. Потому что как выдернуть остальные??
    datagram = JSON.parse(packet);
    
    switch (datagram.type) {
        case 'text':
            //время на клиенте
            text_message_recieved(datagram.value, datagram.sender, getLocalTime());
            break;
        case 'notify':
            notification_recieved(datagram);
            break;
        case 'public_drawing':
            canvases.public_canvas.execute_command_sequence(datagram.commands);
            if (datagram.sender) {
                $('last_public_draw').innerHTML = "Last: <b>" + datagram.sender + "</b> (" + getLocalTime() + ")";
                if (datagram.commands.indexOf('clearall') >= 0) {
                    logg("<b>" + datagram.sender + "</b> очистил общую доску для рисования");
                }
            }
            break;
        case 'roommates':
            $('people_count').innerHTML = datagram.list.length;
            $('list_of_people').innerHTML = "";
            // заполнить список людей
            for(i in datagram.list){
                $('list_of_people').innerHTML += datagram.list[i] + "<br/>";   
            }
            break;
    }
};



var send_datagram = function(datagram) { 
    msg = JSON.stringify(datagram);
    packet = msg;
    window.ws.send(packet);
};

// общение с сервером - уровень текстовых сообщений
var send_text_message = function (msg_text) {
    datagram = {'type': 'text', 'value': msg_text};
    send_datagram(datagram);
};

// получение текстового сообщения
var text_message_recieved = function (msg_text, sender, time) { 
    logg(msg_text, sender, time);
};

    
// системные сообщения
var notification_recieved = function (datagram) {
    switch (datagram.subtype)
    {
        case 'user_left':
            logg("<i><b>" + datagram.user + "</b> покинул конференцию.</i>");
            break;
        case 'user_joined':
            logg("<i><b>" + datagram.user + "</b> присоединился к конференции.</i>");
            break;
        case 'user_renamed':
            logg("<i><b>" + datagram.old_nick + "</b> теперь известен как <b>" + datagram.new_nick + "</b></i>");
            break;
        case 'last_messages':
            logg("<i>Последние сообщения в чате:</i>");
            for(i in datagram.messages){
                text_message_recieved(datagram.messages[i].value, datagram.messages[i].sender, datagram.messages[i].time); 
            }
            break;
    }
    //обновление списка пользователей
    updateUserList();
};