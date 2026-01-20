const WebSocket = require("ws");
const logger = require('./Module/logger');
const config = require('./config.json');
const myFunc = require('./Function');

const port=config.WebSocket.Port;

let wss = null;
const clients = new Map(); // ext -> ws

function startWebSocketServer() {
    if (wss) return wss;

    wss = new WebSocket.Server({ port });

    wss.on("connection", (ws) => {
        logger("WS connected (unregistered)");

        ws.ext = null; // belum register

        ws.on("message", (message) => {
            const msg = message.toString().trim();
            logger("WS RX:", msg);

            handleWsMessage(ws, msg);
        });

        ws.on("close", () => {
            if (ws.ext) {
                clients.delete(ws.ext);
                logger(`WS disconnected: ext=${ws.ext}`);

                const cmd = "SIP_STATUS";
                const status = "OFFLINE";

                const event = {
                    Channel: ws.ext,           //`SIP/${ext}`,
                    ClientIP: "",
                    Status:status
                };

                logger(`SIP_STATUS from ${ws.ext}: ${status}`);

                // kirim ke webhook CRM
                myFunc.postStatus(cmd, event);
            }
        });
    });

    logger(`✅ WS server running on port ${port}`);
    return wss;
}

function handleWsMessage(ws, msg) {
    const parts = msg.split(";");

    const cmd = parts[0].toUpperCase();

    // REGISTER;1003
    if (cmd === "REGISTER") {
        const ext = parts[1];

        if (!ext) {
            ws.send("ERROR;NO_EXTENSION");
            return;
        }

        // jika ext sudah ada, kick koneksi lama
        if (clients.has(ext)) {
            clients.get(ext).close();
        }

        ws.ext = ext;
        clients.set(ext, ws);

        logger(`WS registered: ext=${ext}`);
        ws.send("REGISTERED;OK");
        return;
    }

    // SIP_STATUS;ONLINE;1002;10.14.151.121
    if (cmd === "SIP_STATUS") {
        const statusRaw = (parts[1] || "").toUpperCase(); // ONLINE / OFFLINE
        const ext = parts[2];
        const ip = parts[3];

        if (!ext || !statusRaw) {
            ws.send("ERROR;INVALID_SIP_STATUS_FORMAT");
            return;
        }

        const status = statusRaw;// === "ONLINE" ? "Connected" : "Disconnected";

        const event = {
            Channel: ext,           //`SIP/${ext}`,
            ClientIP: ip || "",
            Status:status
        };

        logger(`SIP_STATUS from ${ext}: ${status} (${ip})`);

        // kirim ke webhook CRM
        myFunc.postStatus(cmd, event);

        ws.send("SIP_STATUS;OK");
        return;
    }

    // command lain dari client (optional)
    logger(`Unhandled WS message from ${ws.ext}: ${msg}`);
}

function sendTo(ext, message) {
    const ws = clients.get(ext);

    if (!ws) {
        logger(`Ext=${ext}.NotFound`);
        return false;
    }

    if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        logger(`EXT=${ext}, Msg=${message}`);
        return true;
    }
    return false;
}

function broadcast(message) {
    for (const ws of clients.values()) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}

module.exports = {
    startWebSocketServer,
    sendTo
};


