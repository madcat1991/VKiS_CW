

// draaaaawing

var public_context = $('public_canvas').getContext('2d');

public_context.fillStyle = "rgb(255,0,0)";
public_context.strokeRect(30, 30, 50, 50);

public_context.beginPath();
public_context.moveTo(10,10);
public_context.lineTo(120,60);
public_context.stroke();

var currently_drawing = false;
$('public_canvas').onmousedown = function (event) {
    var x, y;
    x = event.x - event.target.offsetLeft; y = event.y - event.target.offsetTop;
    currently_drawing = true;
    public_context.beginPath();
    public_context.moveTo(x,y);
};
$('public_canvas').onmouseup = function (event) {
    currently_drawing = false;
    public_context.stroke();
};
$('public_canvas').onmousemove = function (event) {
    if (currently_drawing) {
        var x, y;
        x = event.x - event.target.offsetLeft; y = event.y - event.target.offsetTop;
        public_context.lineTo(x,y);
        public_context.stroke();
    }
};