const express = require('express'),
ws = require('ws'),
https = require('https'),
url = require('url'),
app = express(),
fs = require('fs'),
privateKey = fs.readFileSync('./key.pem'),
certificate = fs.readFileSync('./cert.pem'),
options = {
    key: privateKey,
    cert: certificate
};

app.use(express.static('static'));

const server = https.createServer(options, app).listen(8080, function listening() {
    console.log('Listening on %d', server.address().port);
  });

const wss = new ws.Server({server});

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    wss.clients.forEach((client) => {
        client.send(message);
    });
  });

  ws.on('error', () => console.log('errored'));
});