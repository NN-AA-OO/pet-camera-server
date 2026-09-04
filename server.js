const WebSocket = require("ws");

const PASSWORD = "mugichan";

const wss = new WebSocket.Server({ port: 10000 });
console.log("シグナリングサーバー起動（port 10000）");

let sender = null;
let receiver = null;

wss.on("connection", ws => {
    ws.on("message", msg => {
        const data = JSON.parse(msg);

        if (data.type === "auth") {
            if (data.password !== PASSWORD) {
                ws.send(JSON.stringify({ type: "auth-ng" }));
                return;
            }
            ws.send(JSON.stringify({ type: "auth-ok" }));

            if (!sender) {
                sender = ws;
                console.log("送信側が接続しました");
            } else {
                receiver = ws;
                console.log("受信側が接続しました");
            }
        }

        if (data.type === "offer" && receiver) {
            receiver.send(JSON.stringify({ type: "offer", offer: data.offer }));
        }

        if (data.type === "answer" && sender) {
            sender.send(JSON.stringify({ type: "answer", answer: data.answer }));
        }

        if (data.type === "candidate") {
            if (ws === sender && receiver) receiver.send(JSON.stringify({ type: "candidate", candidate: data.candidate }));
            if (ws === receiver && sender) sender.send(JSON.stringify({ type: "candidate", candidate: data.candidate }));
        }
    });

    ws.on("close", () => {
        if (ws === sender) sender = null;
        if (ws === receiver) receiver = null;
    });
});
