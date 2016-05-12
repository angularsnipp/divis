function generate(n, f){
  f = f || function(i){return i}
  var arr = [];
  for (var i = 1; i <= n; i++){
    arr.push(f(i))
  }
  return arr;
}

function logEvent(element, text){
  var log = document.getElementById(element);
  var div = document.createElement('div');
  div.innerHTML = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}