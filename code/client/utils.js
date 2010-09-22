window.$ = function(id) {
    return document.getElementById(id); // йоу, теперь мы типа как jQuery, йоу!
};

function getLocalTime() {
    var time = new Date();
    var hours = time.getHours();
    hours=((hours < 10) ? "0" : "") + hours;
    var minutes = time.getMinutes();
    minutes=((minutes < 10) ? "0" : "") + minutes;
    var seconds = time.getSeconds();
    seconds=((seconds < 10) ? "0" : "") + seconds;
    return hours + ":" + minutes + ":" + seconds;
};