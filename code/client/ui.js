var rowcount = 0; // число строк таблицы в чате
    
// добавление строки в лог чата
// Использование: logg(служебное_сообщение) или logg(автор, сообщение)
var logg = function(cell1, cell2) { 
    // раскраска строк в зебру
    rowcount += 1;
    var rowclass = '';
    if (rowcount % 2 == 0)
        rowclass = 'chatRow_even';
    else
        rowclass = 'chatRow_odd';
    
    var text = "";
    if (!cell2) {
        text = "<div class='chatString " + rowclass + "'>" + cell1 + "</div>";
    } else {
        text = "<div class='chatString " + rowclass + "'>\n" + 
               "  <div class='usernick'>" + cell1 + "</div>\n" + 
               "  <div class='messageBody'>" + cell2 + "</div\n>" + 
               "</div>\n";
    }
    $('chatLog').innerHTML = $('chatLog').innerHTML + text;
    $('chatLog').scrollTop = $('chatLog').scrollHeight;
};


    

    
// UI  
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
        $('dp_tab_switch_public').className = "tab_switcher_span inactive_tab";
        $('dp_tab_switch_private').className = "tab_switcher_span active_tab";
    } else {
        $('drawing_public').style.display = 'block';
        $('drawing_private').style.display = 'none';
        $('dp_tab_switch_public').className = "tab_switcher_span active_tab";
        $('dp_tab_switch_private').className = "tab_switcher_span inactive_tab";
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
    var new_ip = prompt("Server ip:", server_ip);
    if (new_ip == null)
        return;
    server_ip = new_ip;
    window.ws.close();
    setup_socket(server_ip);
};