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
    
    canvas.img_update = function() {
        canvas.context.drawImage(canvas.temp_element, 0, 0);
        canvas.temp_context.clearRect(0, 0, canvas.temp_element.width, canvas.temp_element.height);
        
        if (canvas.realtime) {
            // send history to server
            var datagram = {'type': 'public_drawing', 'commands': canvas.draw_history};
            send_datagram(datagram);
            // clear history
            canvas.draw_history = []
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
    
    
    // выбор цвета
    var color_selectors_span = canvas.toolbar.getElementsByClassName('color_selectors')[0];
    var available_colors = ['#000000', '#FF0000', '#00FF00', '#0000FF'];
    for (var color_index in available_colors) {
        (function (color) {
            var color_btn = document.createElement('span');
            color_btn.style.backgroundColor = color_btn.style.color = color;
            color_btn.className = 'color_selector_button';
            color_btn.innerHTML = 'W'
            color_btn.onclick = function () {
                canvas.user_color = color;
                canvas.temp_context.fillStyle = canvas.user_color;
                canvas.temp_context.strokeStyle = canvas.user_color;
            };
            
            color_selectors_span.appendChild(color_btn);
        }
        )(available_colors[color_index]);
    }
    
    // кнопка "фтопку"
    var button_clearall = canvas.toolbar.getElementsByClassName('button_clearall')[0];
    if (button_clearall) {
        button_clearall.onclick = function () {
            canvas.context.clearRect(0, 0, canvas.element.width, canvas.element.height);
            var datagram = {'type': 'public_drawing', 'commands': ['clearall',]};
            send_datagram(datagram);
        }
    }
    
    // выбранные в данный момент
    canvas.user_tool = new canvas.tool_set['pencil']();
    canvas.user_color = "#000000";
    canvas.temp_context.fillStyle = canvas.user_color;
    canvas.temp_context.strokeStyle = canvas.user_color;
    
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
            case 'rect':
                break;
            // etc
        };
    };
    
    canvas.execute_command_sequence = function (sequence) { 
        for (i in sequence) {
            canvas.execute_command(sequence[i]);
        }
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
    