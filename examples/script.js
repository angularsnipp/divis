function generate(n, f){
  f = f || function(i){return i}
  var arr = [];
  for (var i = 1; i <= n; i++){
    arr.push(f(i))
  }
  return arr;
}

function logEvent(element, _, text){
  if (_) {
    text =
      '<div class="log-event">'+ _.event +'</div>' +
      '<div class="log-data">data: <pre>'+ JSON.stringify(_.d, null, 2) +'</pre></div>' +
      '<div class="log-index">index: '+ _.i +'</div>';

    if (_.hasOwnProperty('s'))
      text += '<div class="log-series-index">series index: '+ _.s +'</div>';
  }
  var log = document.getElementById(element);
  var div = document.createElement('div');
  div.innerHTML = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}