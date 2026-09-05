const WebSocket = require("ws");

// ★パスワード（sender/receiver と一致させる）
const PASSWORD = "mugisan";

const wss = new WebSocket.Server({ port: 10000 });
console.log("シグナリングサーバー起動（port 10000）");

let sender = null;                 // 送信側（iPad）
let receivers = [];                // 受信側一覧
let nextReceiverId = 1;            // receiver に割り振るID

function broadcastViewerCount() {
    const msg = JSON.stringify({ type: "viewer-count", count: receivers.length });
    if (sender) sender.send(msg);
    receivers.forEach(r => r.ws.send(msg));
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
                // ★receiver として登録
                const id = nextReceiverId++;
                receivers.push({ id, ws });
                console.log(`受信側が接続しました（ID=${id}, 現在 ${receivers.length} 人）`);

                // ★receiver本人に自分のIDを通知
                ws.send(JSON.stringify({ type: "receiver-id", receiverId: id }));

                // ★sender に「新しい視聴者が来たよ」と通知
                if (sender) {
                    sender.send(JSON.stringify({ type: "receiver-joined", receiverId: id }));
                }
            }

            broadcastViewerCount();
        }

        // ★sender → 特定 receiver に offer を送る
        if (data.type === "offer") {
            const targetId = data.receiverId;
            const target = receivers.find(r => r.id === targetId);
            if (target) {
                target.ws.send(JSON.stringify({
                    type: "offer",
                    offer: data.offer,
                    receiverId: targetId
                }));
                console.log(`offer を受信側ID=${targetId} に送信`);
            }
        }

        // ★receiver → sender に answer を送る
        if (data.type === "answer") {
            if (sender) {
                sender.send(JSON.stringify({
                    type: "answer",
                    answer: data.answer,
                    receiverId: data.receiverId
                }));
                console.log(`answer を送信（receiverId=${data.receiverId}）`);
            }
        }

        // ★ICE candidate の送信（sender ⇔ 特定 receiver）
        if (data.type === "candidate") {
            const targetId = data.receiverId;

            // sender から来た candidate → 該当 receiver へ
            if (ws === sender) {
                const target = receivers.find(r => r.id === targetId);
                if (target) {
                    target.ws.send(JSON.stringify({
                        type: "candidate",
                        candidate: data.candidate,
                        receiverId: targetId
                    }));
                    console.log(`candidate を受信側ID=${targetId} に送信`);
                }
            } else {
                // receiver から来た candidate → sender へ
                if (sender) {
                    sender.send(JSON.stringify({
                        type: "candidate",
                        candidate: data.candidate,
                        receiverId: targetId
                    }));
                    console.log(`candidate を送信（receiverId=${targetId}）`);
                }
            }
        }
    });

    ws.on("close", () => {
        if (ws === sender) {
            sender = null;
            console.log("送信側が切断されました");

            receivers.forEach(r => {
                r.ws.send(JSON.stringify({ type: "sender-disconnected" }));
            });
        } else {
            const before = receivers.length;
            receivers = receivers.filter(r => r.ws !== ws);
            const after = receivers.length;
            console.log(`受信側が切断されました（前 ${before} → 現在 ${after} 人）`);
        }
        broadcastViewerCount();
    });
});
