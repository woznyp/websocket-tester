document.onreadystatechange = () => {
  if (document.readyState === "complete") {
    const auth = new Auth();
    auth
      .askForToken(prompt("password"))
      .then(() => {
        const gallery = new Gallery(),
          websocketHandler = new WebsocketHandler(auth, gallery);
        websocketHandler
          .init()
          .then(() => {
            const camera = new Camera(websocketHandler);
            camera.createCameraElements();
          })
          .catch(() => {
            Logger.log("Error in connection to websocket server");
          });
      })
      .catch(err => {
        document.write(err);
      });
  }
};

class Auth {
  constructor() {
    this.token = null;
  }

  askForToken(password) {
    const promise = new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.open("GET", `/token/${password}`, true);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status === 200) {
            this.token = xhr.response;
            resolve();
          } else {
            reject(xhr.status + "###" + xhr.statusText);
          }
        }
      };
      xhr.send();
    });
    return promise;
  }
}

class Logger {
  static log() {
    console.log(...arguments);
  }
}

class Camera {
  constructor(websocketHandler) {
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasContext = null;
    this.streamStatus = null;
    this.websocketHandler = websocketHandler;
  }

  initializeCanvas(reference) {
    let image = new Image();
    image.src = "/play-background.png";
    image.onload = () => {
      reference.drawImage(image, 0, 0, 320, 240);
    };
  }

  createCameraElements() {
    this.videoElement = document.createElement("video");
    this.canvasElement = document.createElement("canvas");
    this.canvasContext = this.canvasElement.getContext("2d");

    this.videoElement.classList.add("hidden");
    this.canvasElement.classList.add("my");
    this.canvasElement.width = 320;
    this.canvasElement.height = 240;

    this.initializeCanvas(this.canvasContext);

    this.canvasElement.addEventListener("click", () => {
      if (!this.streamStatus) {
        this.startStream();
      } else {
        this.endStream();
      }
    });

    document.body.appendChild(this.videoElement);
    document.body.appendChild(this.canvasElement);
  }

  startStream() {
    this.websocketHandler.send("init");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        this.videoElement.srcObject = stream;
        this.videoElement.play();
        this.streamStatus = window.setInterval(() => {
          this.canvasContext.drawImage(this.videoElement, 0, 0, 320, 240);
          this.websocketHandler.send({
            topic: "frame",
            data: {
              id: this.websocketHandler.id,
              source: this.canvasElement.toDataURL("image/jpeg", 0.3)
            }
          });
        }, 50);
      });
    }
  }

  endStream() {
    window.clearInterval(this.streamStatus);
    this.videoElement.srcObject.getVideoTracks()[0].stop();
    this.streamStatus = null;
    this.initializeCanvas(this.canvasContext);
  }
}

class Gallery {
  constructor() {
    this.previews = {};
  }
  addPreview(id) {
    if (this.previews[id]) {
      return;
    }
    const canvasElement = document.createElement("canvas"),
      canvasContext = canvasElement.getContext("2d");

    canvasElement.classList.add("other");
    canvasElement.width = 320;
    canvasElement.height = 240;
    this.previews[id] = { canvas: canvasElement, context: canvasContext };

    let image = new Image();
    image.src = "/play-background.png";
    image.onload = () => {
      canvasContext.drawImage(image, 0, 0, 320, 240);
    };
    document.body.appendChild(canvasElement);
  }
  removePreview(id) {
    if (!this.previews[id]) {
      return;
    }
    this.previews[id].canvas.remove();
    delete this.previews[id];
  }
  updatePreview(id, source) {
    if (!this.previews[id]) {
      return;
    }
    let image = new Image();
    image.src = source;
    image.onload = () => {
      this.previews[id].context.drawImage(image, 0, 0, 320, 240);
    };
  }
}

class WebsocketHandler {
  constructor(auth, gallery) {
    this.url = `wss://${window.location.hostname}:8080`;
    this.connection = null;
    this.id = null;
    this.auth = auth;
    this.gallery = gallery;
  }

  init() {
    const promise = new Promise((resolve, reject) => {
      this.url = this.url + this.auth.token;
      this.connection = new WebSocket(this.url);
      this.connection.onopen = () => {
        Logger.log("connection opened");
        this.connection.onmessage = this.handleMessage.bind(this);
        resolve();
      };

      this.connection.onerror = err => {
        Logger.log("connection error", err);
        reject();
      };
    });

    return promise;
  }

  handleMessage(message) {
    const msg = JSON.parse(message.data);
    switch (msg.topic) {
      case "settings":
        if (this.id === null) {
          this.id = msg.data.id;
          msg.data.clients.map(id => {
            this.gallery.addPreview(id);
          });
        }
        break;
      case "ws-add":
        this.gallery.addPreview(msg.data.id);
        break;
      case "ws-remove":
        this.gallery.removePreview(msg.data.id);
        break;
      case "frame":
        this.gallery.updatePreview(msg.data.id, msg.data.source);
        break;
    }
  }

  send(message) {
    if (this.connection.readyState === 1) {
      this.connection.send(
        JSON.stringify({ topic: message.topic || "", data: message.data })
      );
    }
  }
}
