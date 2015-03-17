var
  http = require('http'),
  sockjs = require('sockjs'),
  socket = sockjs.createServer(),
  connections = [],
  players = [],
  games = [],
  routes = {};

socket.on('connection', function (conn) {
  console.log('New connection', conn.id);
  connections.push(conn);
  console.log('connections:', connections.length);

  send(conn.id, 'connection.info', {
    id: conn.id
  });

  conn.on('data', function (payload) {
    console.log(conn.id, ' > data: ' + payload);
    handleData(conn, payload);
  });

  conn.on('close', function () {
    connections.splice(connections.indexOf(conn), 1);
    removePlayer(conn.id);
    console.log('Closed connection');
  });
});

var handleData = function (conn, payload) {
  var eventData = JSON.parse(payload) || false;
  console.log('handleData', eventData);
  if (eventData) {
    handleRoute(conn, eventData.event, eventData.data);
  }
};

var handleRoute = function (conn, route, data) {
  console.log('handleRoute', route, data);
  if (routes[route]) {

    var totalCallbacks = routes[route].length;
    for (var i = 0; i < totalCallbacks; i++) {
      routes[route][i].call(undefined, conn, data);
    }
  }
};

var addRoute = function (route, callback) {
  if (!routes[route]) {
    routes[route] = [];
  }
  routes[route].push(callback);
};

var emit = function (name, data, id, conn) {
  var payload = JSON.stringify({
    id: id,
    from: conn ? conn.id : false,
    name: name,
    data: data
  })
  console.log('emit', payload);
  var totalConnections = connections.length;
  for (var i = 0; i < totalConnections; i++) {
    connections[i].write(payload);
  }
};

var send = function (to, name, data) {
  var payload = {
    name: name,
    data: data || ''
  };
  var totalConnections = connections.length;
  for (var i = 0; i < totalConnections; i++) {
    if (connections[i].id === to) {
      connections[i].write(JSON.stringify(payload));
      break;
    }
  }
};

function getPlayerByConnectionId(connId) {
  var totalPlayers = players.length;
  for (var i = 0; i < totalPlayers; i++) {
    if (players[i].connection_id === connId) {
      return players[i];
    }
  }
}

function newPlayer(conn, data) {
  console.log('players.new', data);
  if(!getPlayerByConnectionId(conn.id)) {
    data.connection_id = conn.id;
    players.push(data);
    emit('players.list', players);
  }
}

function removePlayer(connId) {
  var totalPlayers = players.length;
  for(var i = 0; i < totalPlayers; i++) {
    if(players[i].connection_id === connId) {
      players.splice(i, 1);
      break;
    }
  }
  emit('players.list', players);
}

function newGameId(connId) {
  return (new Date()).getTime() + '-' + connId;
}

function gameRequest(conn, data) {
  console.log('game.request', data);
  var from = getPlayerByConnectionId(data.from);
  if(from) {
    send(data.to, 'game.request', {id: newGameId(from.connection_id), from : from});
  }
}

function setPlayerToBusy(connId) {
  var totalPlayers = players.length;
  for(var i = 0; i < totalPlayers; i++) {
    if(players[i].connection_id === connId) {
      players[i].playing = true;
      break;
    }
  }
}

function acceptGameRequest(conn, data) {
  console.log('acceptGameRequest', data);
  var one = getPlayerByConnectionId(conn.id);
  var two = getPlayerByConnectionId(data.to.connection_id);
  one.piece = data.piece;
  two.piece = data.piece === 'x' ? 'o' : 'x';
  var game = {
    id: data.id,
    started : new Date(),
    players : [one, two]
  };
  games.push(game);
  var payload = {
    game : game,
    one : one,
    two : two
  }

  setPlayerToBusy(one.connection_id);
  setPlayerToBusy(two.connection_id);

  send(one.connection_id, 'game.start', payload);
  send(two.connection_id, 'game.start', payload);

}

function declineGameRequest(conn, data) {
  console.log('declineGameRequest', data);

}

function gameState(conn, data) {
  console.log('game.state', data);
  for(var i = 0; i < data.players.length; i++) {
    send(data.players[i].connection_id, 'game.state', data);
  }
}

function setRoutes() {
  addRoute('players.new', newPlayer);
  addRoute('game.request', gameRequest);
  addRoute('game.request.accept', acceptGameRequest);
  addRoute('game.request.decline', declineGameRequest);
  addRoute('game.state', gameState);
}

setRoutes();

var server = http.createServer();
socket.installHandlers(server, {
  prefix: '/tictactoe'
});

server.listen(6975);