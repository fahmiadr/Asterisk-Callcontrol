const WebSocket = require("ws");
const logger = require('./Module/logger');
const config = require('./config.json');

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


