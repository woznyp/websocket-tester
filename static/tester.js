class Tester {
    constructor() {
        this.connection = new WebSocket('wss://'+window.location.hostname+':8080');
        this.connection.onopen = function () {
            console.log('connection opened');
        };

        // Log errors
        this.connection.onerror = function (error) {
            console.log('WebSocket Error ' + error);
        };

        // Log messages from the server
        this.connection.onmessage = (e) => {
            let image = document.createElement('img'),
            canvas = document.getElementById('preview'),
            context = canvas.getContext('2d');
            image.onload = () => {
                context.drawImage(image, 0, 0, 640, 480);
            }

            image.src = e.data;
        };
    }

    test() {
        var video = document.getElementById('video'),
            canvas = document.getElementById('canvas'),
            context = canvas.getContext('2d');

        // Get access to the camera!
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Not adding `{ audio: true }` since we only want video now
            navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
                video.src = window.URL.createObjectURL(stream);
                video.play();
                setInterval(() => {
                    context.drawImage(video, 0, 0, 640, 480);
                    this.sendImage( canvas.toDataURL('image/jpeg', 0.1));
                }, 20);
            });
        }
    }

    sendImage(imageData) {
        this.connection.send(imageData);
    }
}

window.tester = new Tester();