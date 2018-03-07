const express = require("express"),
  ws = require("ws"),
  https = require("https"),
  url = require("url"),
  app = express(),
  fs = require("fs"),
  config = require("./config"),
  privateKey = fs.readFileSync("./key.pem"),
  certificate = fs.readFileSync("./cert.pem"),
  options = {
    key: privateKey,
    cert: certificate
  },
  tokens = new Set();

app.use(express.static("static"));

function generateToken() {
  const token = `${new Date().getTime()}-${Math.random() * 1000}`,
    timestamp = `?token=${token}`;
  tokens.add(token);
  return timestamp;
}

app.get("/token/:id", (req, res) => {
  if (req.params.id === config.password) {
    res.status(200).send(generateToken());
  } else {
    res.status(401).send("Incorrect password");
  }
});

const server = https
  .createServer(options, app)
  .listen(8080, function listening() {
    console.log("Listening on %d", server.address().port);
  });

const wss = new ws.Server({ server });

wss.on("connection", function connection(ws, req) {
  let token = url.parse(req.url, true).query.token,
    clients = [];
  if (!tokens.has(token)) {
    console.log("incorrect token");
    ws.close(1000, "Incorrect token");
  } else {
    ws.id = ws._ultron.id;

    wss.clients.forEach(client => {
      if (ws.id !== client._ultron.id) {
        clients.push(client._ultron.id);
      }
    });

    ws.send(
      JSON.stringify({
        topic: "settings",
        data: { id: ws._ultron.id, clients: clients }
      })
    ); // be aware of this id

    wss.clients.forEach(client => {
      if (client._ultron.id && client._ultron.id !== ws._ultron.id) {
        client.send(
          JSON.stringify({ topic: "ws-add", data: { id: ws._ultron.id } })
        );
      }
    });

    ws.on("message", function incoming(message) {
      const msg = JSON.parse(message);
      wss.clients.forEach(client => {
        if (client._ultron.id && ws.id !== client._ultron.id) {
          client.send(message);
        }
      });
    });

    ws.on("close", () => {
      wss.clients.forEach(client => {
        console.log("closing connection", ws.id);
        if (client._ultron.id && client._ultron.id !== ws.id) {
          client.send(
            JSON.stringify({ topic: "ws-remove", data: { id: ws.id } })
          );
        }
      });
    });

    ws.on("error", () => console.log("errored"));
  }
});
