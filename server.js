const WebSocket = require("ws");

// ★パスワード（sender/receiver と一致させる）
const PASSWORD = "mugisan";

const wss = new WebSocket.Server({ port: 10000 });
console.log("シグナリングサーバー起動（port 10000）");

let sender = null;
let receivers = []; // ★複数受信者を管理

function broadcastViewerCount() {
    const msg = JSON.stringify({ type: "viewer-count", count: receivers.length });
    if (sender) sender.send(msg);
    receivers.forEach(r => r.send(msg));
}

wss.on("connection", ws => {
    ws.on("message", msg => {
        const data = JSON.parse(msg);

        // ★認証
        if (data.type === "auth") {
            if (data.password !== PASSWORD) {
                ws.send(JSON.stringify({ type: "auth-ng" }));
                console.log("認証失敗");
                return;
            }

            ws.send(JSON.stringify({ type: "auth-ok" }));
            console.log("認証成功");

            // ★sender が未接続なら sender として登録
            if (!sender) {
                sender = ws;
                console.log("送信側が接続しました");
            } else {
                receivers.push(ws);
                console.log("受信側が接続しました（現在 " + receivers.length + " 人）");
            }

            broadcastViewerCount();
        }

        // ★sender → receiver に offer を送る
        if (data.type === "offer") {
            receivers.forEach(r => {
                r.send(JSON.stringify({ type: "offer", offer: data.offer }));
            });
            console.log("offer を全受信者に送信");
        }

        // ★receiver → sender に answer を送る
        if (data.type === "answer") {
            if (sender) {
                sender.send(JSON.stringify({ type: "answer", answer: data.answer }));
            }
            console.log("answer を送信");
        }

        // ★ICE candidate の送信
        if (data.type === "candidate") {
            if (ws === sender) {
                receivers.forEach(r => {
                    r.send(JSON.stringify({ type: "candidate", candidate: data.candidate }));
                });
            } else {
                if (sender) {
                    sender.send(JSON.stringify({ type: "candidate", candidate: data.candidate }));
                }
            }
            console.log("candidate を送信");
        }
    });

    ws.on("close", () => {
        if (ws === sender) {
            sender = null;
            console.log("送信側が切断されました");
        } else {
            receivers = receivers.filter(r => r !== ws);
            console.log("受信側が切断されました（現在 " + receivers.length + " 人）");
        }
        broadcastViewerCount();
    });
});
