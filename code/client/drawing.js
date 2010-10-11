// данный юзер должен рисовать цветом,
// указанным в window.drawing_color
// (заполняется при успешном логине)

var canvases = {
    public_canvas: {
        element: $('public_canvas'),
        toolbar: $('public_draw_tools'),
        realtime: true
    },
    private_canvas: {
        element: $('private_canvas'),
        toolbar: $('private_draw_tools'),
        realtime: false
    },
};


var prepare_canvas = function (canvas, name) {
    canvas.name = name;
    canvas.context = canvas.element.getContext('2d');
    
    var container = canvas.element.parentElement;
    canvas.temp_element = document.createElement('canvas');
    canvas.temp_element.tag = 'temp_for_' + i;
    container.appendChild(canvas.temp_element);
    
    container.style.position = 'relative';
    canvas.temp_element.style.position = 'absolute';
    canvas.temp_element.style.top = 0;
    canvas.temp_element.style.left = 0;
    
    
    
    canvas.temp_context = canvas.temp_element.getContext('2d');
   
    // на сервер будем передавать не пиксели, а последовательность команд 
    // для воспроизведения картинки... См. описание М7 в протоколе
    canvas.draw_history = [];
    
    canvas.append_to_history = function (param) {
        var hist_item = {
            'color': canvas.user_color,
            'tool': canvas.user_tool.name,
            'param': param
        };
        canvas.draw_history.push(hist_item);
    };
    
    canvas.flush_history = function () {
        // send history to server
        var datagram = {'type': 'public_drawing', 'commands': canvas.draw_history};
        send_datagram(datagram);
        // clear history
        canvas.draw_history = []
    };
    
    canvas.img_update = function() {
        canvas.context.drawImage(canvas.temp_element, 0, 0);
        canvas.temp_context.clearRect(0, 0, canvas.temp_element.width, canvas.temp_element.height);
        
        if (canvas.realtime) {
            canvas.flush_history();
        };
    };
    
    canvas.things = {};
    
    // конструкторы инструментов
    canvas.tool_set = {};
    canvas.tool_set.pencil = function() { 
        var tool = this;
        this.name = 'pencil';
        var context = canvas.temp_context;
        
        this.started = false;
        
        this.prev_pos = {'x': -1, 'y': -1};
        
        this.mousedown = function (ev) {
            context.beginPath();
            context.moveTo(ev._x, ev._y);
            tool.started = true;
            tool.prev_pos = {'x': ev._x, 'y': ev._y};
        };
        
        this.mousemove = function (ev) {
            if (tool.started) {
                var new_pos = {'x': ev._x, 'y': ev._y};
                canvas.append_to_history({'p1': tool.prev_pos, 'p2': new_pos});
                context.lineTo(ev._x, ev._y);
                context.stroke();
                tool.prev_pos = new_pos;
                canvas.flush_history();
            }
        };
        
        this.mouseup = function (ev) {
            if (tool.started) {
                tool.mousemove(ev);
                tool.started = false;
                canvas.img_update();
            }
        };
        
        return tool;
    }; // end pencil
    
    canvas.tool_set.line = function() { 
        var tool = this;
        this.name = 'line';
        var context = canvas.temp_context;
        
        this.started = false;
        
        this.prev_pos = {'x': -1, 'y': -1};
        
        this.mousedown = function (ev) {
            tool.started = true;
            tool.prev_pos = {'x': ev._x, 'y': ev._y};
        };
        
        this.mousemove = function (ev) {
            if (tool.started) {
                context.clearRect(0, 0, canvas.temp_element.width, canvas.temp_element.height);
                
                context.beginPath();
                context.moveTo(tool.prev_pos.x, tool.prev_pos.y);
                context.lineTo(ev._x, ev._y);
                context.stroke();
            }
        };
        
        this.mouseup = function (ev) {
            if (tool.started) {
                tool.mousemove(ev);
                tool.started = false;
                var new_pos = {'x': ev._x, 'y': ev._y};
                canvas.append_to_history({'p1': tool.prev_pos, 'p2': new_pos});
                canvas.img_update();
            }
        };
        
        return tool;
    }; // end line
    
    canvas.tool_set.rectangle = function() { 
        var tool = this;
        this.name = 'rectangle';
        var context = canvas.temp_context;
        
        this.started = false;
        
        this.prev_pos = {'x': -1, 'y': -1};
        
        this.mousedown = function (ev) {
            tool.started = true;
            tool.prev_pos = {'x': ev._x, 'y': ev._y};
        };
        
        this.mousemove = function (ev) {
            if (!tool.started){
                return;
            }
        
            var x = Math.min(ev._x, tool.prev_pos.x),
                y = Math.min(ev._y, tool.prev_pos.y),
                width = Math.abs(ev._x - tool.prev_pos.x),
                height = Math.abs(ev._y - tool.prev_pos.y);
        
            context.clearRect(0, 0, canvas.temp_element.width, canvas.temp_element.height);
             
            if (!width || !height){
                return;
            }
                            
            context.strokeRect(x, y, width, height);
        };
        
        this.mouseup = function (ev) {
            if (tool.started) {
                tool.mousemove(ev);
                tool.started = false;
                tool.last_pos = {'x': ev._x, 'y': ev._y};
                canvas.append_to_history({'p1': tool.prev_pos, 'p2': tool.last_pos });
                canvas.img_update();
            }
        };
        
        return tool;
    }; // end rectangle
    
    canvas.tool_set.text_tool = function() { 
        var tool = this;
        this.name = 'text_tool';
        var context = canvas.temp_context;
        
        this.text = "";
        this.started = false;
        
        this.prev_pos = {'x': -1, 'y': -1};
        
        this.mousedown = function (ev) {
            if ( tool.started ){
                //сохранение и очищение строки
                tool.save_and_clear();
            }
            tool.started = true;
            tool.prev_pos = {'x': ev._x, 'y': ev._y};
        };
        
        this.keydown = function (ev) {
            if (!tool.started){
                return;
            }
        
            if (ev.keynum = 8){
                if (tool.text.length > 0){
                    tool.text = tool.text.substring(0,tool.text.length-1);
                }
            }                
            else if (ev.keynum = 13){
                tool.save_and_clear();
            }
            else{
                letterAndDigitsCheck = "[\d\w]";
                keychar = String.fromCharCode(keynum);
                if (letterAndDigitsCheck.test(keychar)){
                    tool.text += keychar;    
                }
            }
        
            context.clearRect(0, 0, canvas.temp_element.width, canvas.temp_element.height);
             
            if (tool.text.length == 0){
                return;
            }
            
            context.font = 'italic 30px sans serif';            
            context.fillText(tool.text, tool.prev_pos.x, tool.prev_pos.y);
        };
        
        this.save_and_clear = function () {
            if (tool.started) {
                tool.started = false;
                canvas.append_to_history({'p1': tool.prev_pos, 'text': tool.text });
                canvas.img_update();
                tool.text = "";
            }
        };
        
        return tool;
    }; // end text_tool
    
    // панель инструментов
    for (var toolname in canvas.tool_set) {
        (function (tool_name) {
            var tool_buttons = canvas.toolbar.getElementsByClassName('button_' + tool_name);
            if (0 in tool_buttons) {
                var tool_button = tool_buttons[0];
                tool_button.onclick = function () {
                    canvas.user_tool = new canvas.tool_set[tool_name]();
                };
            }
         }
        )(toolname);
    }
    
    // кнопка "фтопку"
    var button_clearall = canvas.toolbar.getElementsByClassName('button_clearall')[0];
    if (button_clearall) {
        button_clearall.onclick = function () {
            var datagram = {'type': 'public_drawing', 'commands': ['clearall',]};
            send_datagram(datagram);
        }
    }
    
    canvas.set_color = function(new_color){
        canvas.user_color = new_color;
        canvas.temp_context.fillStyle = canvas.user_color;
        canvas.temp_context.strokeStyle = canvas.user_color;
    };
   
    // выбранные в данный момент
    canvas.user_tool = new canvas.tool_set['pencil']();
    canvas.set_color("#000000");
    
    canvas.keyboard_handler = function(event){
        if(event.which){    // Netscape/Firefox/Opera
            event.keynum = event.which;
        }
        else{   //IE = window.event
            event.keynum = event.keyCode;
        }
        
        // Call the event handler of the tool.
        var func = canvas.user_tool[event.type];
        if (func) {
            func(event);
        } else { 
            alert('no func for ' + event.type);
        }
    };
    
    canvas.mouse_handler = function (event) {
        if (event.layerX || event.layerX == 0) { // Firefox
              event._x = event.layerX;
              event._y = event.layerY;
        } else if (event.offsetX || event.offsetX == 0) { // Opera
              event._x = event.offsetX;
              event._y = event.offsetY;
        }

        // Call the event handler of the tool.
        var func = canvas.user_tool[event.type];
        if (func) {
            func(event);
        } else { 
            alert('no func for ' + event.type);
        }
    };
    
    canvas.temp_element.addEventListener('mousedown', canvas.mouse_handler, false);
    canvas.temp_element.addEventListener('mousemove', canvas.mouse_handler, false);
    canvas.temp_element.addEventListener('mouseup',   canvas.mouse_handler, false);
    canvas.temp_element.addEventListener('keydown',   canvas.keyboard_handler, false);
    
    canvas.execute_command = function (hist_item) {
        // при интерпретации входящих команд рисуем сразу на основном canvas
        canvas.context.fillStyle = hist_item.color;
        canvas.context.strokeStyle = hist_item.color;
        
        if (hist_item == 'clearall') {
            canvas.context.clearRect(0, 0, canvas.element.width, canvas.element.height);
            return;
        }
        
        switch (hist_item.tool) {
            case 'line':
            case 'pencil':
                canvas.context.beginPath();
                canvas.context.moveTo(hist_item.param.p1.x, hist_item.param.p1.y);
                canvas.context.lineTo(hist_item.param.p2.x, hist_item.param.p2.y);
                canvas.context.stroke();
                break;
            case 'rectangle':
                x = Math.min(hist_item.param.p1.x, hist_item.param.p2.x);
                y = Math.min(hist_item.param.p1.y, hist_item.param.p2.y);
                width = Math.abs(hist_item.param.p1.x - hist_item.param.p2.x);
                height = Math.abs(hist_item.param.p1.y - hist_item.param.p2.y);
                            
                canvas.context.strokeRect(x, y, width, height);
                break;
            case 'text_tool':
                context.font = 'italic 30px sans serif';            
                context.fillText(hist_item.param.text, hist_item.param.p1.x, hist_item.param.p1.y);
                break;
            // etc
        };
    };
    
    canvas.execute_command_sequence = function (sequence) { 
        for (i in sequence) {
            canvas.execute_command(sequence[i]);
        }
    };
    
    //очистка канваса
    canvas.clear_canvas = function(){
        canvas.context.clearRect(0, 0, canvas.element.width, canvas.element.height);
    };
    
    return canvas;
};

for (i in canvases) {
    canvases[i] = prepare_canvas(canvases[i]);
};


window.addEventListener('load', function () {
    for (i in canvases) {
        var canvas = canvases[i];
        canvas.temp_element.width = canvas.temp_element.style.width = canvas.element.width = 500;
        canvas.temp_element.height = canvas.temp_element.style.height = canvas.element.height = 320;
    }
});
    