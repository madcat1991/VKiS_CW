﻿var rowcount = 0; // число строк таблицы в чате
    
// добавление строки в лог чата
// Использование: logg(служебное_сообщение) или logg(сообщение, автор, время)
var logg = function(cellMessage, cellName, cellTime) { 
    // раскраска строк
    var rowclass = '';
    if (cellName == window.chat_nick)
        rowclass = 'chatRow_own';
    else
        rowclass = 'chatRow_foreign';
    
    var text = "";
    if (!cellName) {
        text = "<div class='chatString " + rowclass + " " + $('style_select').value + "'>" + cellMessage + "</div>";
    } else {
        text = "<div class='chatString " + rowclass + " " + $('style_select').value + "'>\n" + 
               "  <div class='usernick'>" + cellName + ' (' + cellTime + ') ' + "</div>\n" + 
               "  <div class='messageBody'>" + cellMessage + "</div\n>" + 
               "</div>\n";
    }
    $('chatLog').innerHTML = $('chatLog').innerHTML + text;
    $('chatLog').scrollTop = $('chatLog').scrollHeight;
};


    

    
var edit_keypress = function (event) {
    if (event.keyCode == 13 && !event.shiftKey) {
        if ($('inputbox').innerHTML != "") {
            send_text_message($('inputbox').innerHTML);
            $('inputbox').innerHTML = ""; // тут внезапно теряется фокус
            
            $('inputbox').blur();  // хитро возвращаем фокус
            $('inputbox').focus();
        }
        
        event.preventDefault(); // не пускаем символ дальше
        return false;
    }
};


$('drawing_public').style.display = 'block';

var toggle_drawing_tabs = function (event) { 
    if ($('drawing_public').style.display == 'block') {
        $('drawing_public').style.display = 'none';
        $('drawing_private').style.display = 'block';
        $('dp_tab_switch_public').className = "tab_switcher_span inactive_tab" + " " + $('style_select').value;
        $('dp_tab_switch_private').className = "tab_switcher_span active_tab" + " " + $('style_select').value;
    } else {
        $('drawing_public').style.display = 'block';
        $('drawing_private').style.display = 'none';
        $('dp_tab_switch_public').className = "tab_switcher_span active_tab" + " " + $('style_select').value;
        $('dp_tab_switch_private').className = "tab_switcher_span inactive_tab" + " " + $('style_select').value;
    }
};

$('dp_tab_switch_private').onclick = toggle_drawing_tabs;
$('dp_tab_switch_public').onclick = toggle_drawing_tabs;


//переименование пользователя
function renameNickname(){        
    var nick = prompt('Введите ваш псевдоним:', chat_nick).trim();
    if (nick == null || nick == '' || localStorage.getItem('chat_nick') == nick) {
        return; // null - кнопка Cancel, а пустой или повторяющийся ник нам не нужен
    }
    localStorage.setItem('chat_nick', nick);
        
    window.chat_nick = localStorage.getItem('chat_nick');
    $('userNickInfo').innerHTML = "Вас зовут <b>" + chat_nick + "</b> (<a href='#' onclick='renameNickname()'>сменить ник</a>)";
    
    send_datagram({'type': 'set-name', 'new_name': chat_nick}); // Сервер поймет это как M4б, т.к. юзер уже имеет имя
}

//обновление списка пользователей
function updateUserList(){
    send_datagram({'type': 'roommates'});
}

var toggle_people_list = function() { 
    if ($('list_of_people').style.display == 'none') {
        $('list_of_people').style.display = 'block';
        $('list_of_people').style.left = 227;
        $('list_of_people').style.top = 99; // неструктуррно. Пофиг.
    } else {
        $('list_of_people').style.display = 'none';
    }
};

$('list_of_people').style.display = 'none';

var reconnect_prompt = function() {
    window.ws.close();
    set_login_status("");
    $('login_ip').focus();
};


// ============= новый интерфейс для подключения к серверу ============

var set_login_status = function(text, color) {
    if (!color)
        color = 'black';
    if ($('modal_window_container').style.display != 'block') 
        $('modal_window_container').style.display = 'block';
    
    $('login_statusbar').innerHTML = text;
    $('login_statusbar').style.color = color;
    
};

var hide_login_window = function() {
    $('modal_window_container').style.display = 'none';
};


$('login_form').onsubmit = function () {
    var uri = $('login_ip').value.trim();
    var nick = $('login_nick').value.trim();
    var pass = $('login_pass').value.trim();
    
    if (uri == '') { set_login_status('Введите адрес сервера', 'red'); return; }
    if (nick == '') { set_login_status('Введите имя участника', 'red'); return; }
    if (pass == '') { set_login_status('Введите пароль', 'red'); return; }
    
    set_login_status('Подключение...', 'blue');
    
    server_ip = uri;
    setup_socket(nick, pass);
    
    return false; // предотвратить отправку формы
};

function clientOnLoad(){
    var headId = document.getElementsByTagName('head')[0];
    var cssNode = document.createElement('link');
    cssNode.type = 'text/css';
    cssNode.rel = 'stylesheet';
    cssNode.href = $('style_select').value + '_style.css';
    cssNode.id = 'style';
    headId.appendChild(cssNode);
}

function styleOnChange(){ 
    var allsuspects = document.getElementsByTagName('link');
    for (var i=allsuspects.length; i>=0; i--){
        if (allsuspects[i] && allsuspects[i].getAttribute('id') == 'style'){
            allsuspects[i].setAttribute('href', $('style_select').value + '_style.css');
        }          
    }
    
    return false;
}
