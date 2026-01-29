const WebSocket = require("ws");
const logger = require('./Module/logger');
const config = require('./config.json');
const myFunc = require('./Function');

const port = config.WebSocket.Port;

let wss = null;
const clients = new Map(); // ext -> ws

function startWebSocketServer() {
    if (wss) return wss;

    wss = new WebSocket.Server({ port });

    wss.on("connection", (ws) => {
        logger("WS connected (unregistered)");
        ws.ext = null;

        ws.on("message", (message) => {
            const msg = message.toString().trim();
            logger("WS RX:", msg);
            handleWsMessage(ws, msg);
        });

        ws.on("close", () => {
            if (ws.ext && clients.get(ws.ext) === ws) {
                clients.delete(ws.ext);
                logger(`WS disconnected: ext=${ws.ext}`);

                const event = {
                    Channel: ws.ext,
                    ClientIP: "",
                    Status: "OFFLINE"
                };

                myFunc.postStatus("SIP_STATUS", event);
            }
        });

        ws.on("error", (err) => {
            logger(`WS error (ext=${ws.ext || "N/A"}): ${err.message}`);
        });
    });

    logger(`✅ WS server running on port ${port}`);
    return wss;
}

function handleWsMessage(ws, msg) {
    const parts = msg.split(";");
    const cmd = (parts[0] || "").toUpperCase();

    // =========================
    // REGISTER;1003
    // =========================
    if (cmd === "REGISTER") {
        const ext = parts[1];

        if (!ext) {
            safeSend(ws, "ERROR;NO_EXTENSION");
            return;
        }

        // kick koneksi lama jika ada (tapi jangan self)
        if (clients.has(ext)) {
            const oldWs = clients.get(ext);
            if (oldWs && oldWs !== ws) {
                try {
                    oldWs.close();
                    logger(`WS old connection closed: ext=${ext}`);
                } catch (e) {
                    logger(`WARN: Failed closing old WS for ext=${ext}: ${e}`);
                }
            }
            clients.delete(ext);
        }

        ws.ext = ext;
        clients.set(ext, ws);

        logger(`WS registered: ext=${ext}`);
        safeSend(ws, "REGISTERED;OK");
        return;
    }

    // =========================
    // SIP_STATUS;ONLINE;1002;10.14.151.121
    // =========================
    if (cmd === "SIP_STATUS") {
        const statusRaw = (parts[1] || "").toUpperCase();
        const ext = parts[2];
        const ip = parts[3] || "";

        if (!statusRaw || !ext) {
            safeSend(ws, "ERROR;INVALID_SIP_STATUS_FORMAT");
            return;
        }

        // validasi: ext harus sama dengan yang register
        if (!ws.ext || ws.ext !== ext) {
            logger(`WARN: SIP_STATUS ext mismatch: ws.ext=${ws.ext}, msg.ext=${ext}. SEND.OFFLINE.to.WEBHOOK`);
            safeSend(ws, "ERROR;EXT_MISMATCH");
            
            ext=ws.ext;
            statusRaw='OFFLINE';

            //return;
        }

        const event = {
            Channel: ext,
            ClientIP: ip,
            Status: statusRaw
        };

        logger(`SIP_STATUS from ${ext}: ${statusRaw} (${ip})`);
        myFunc.postStatus("SIP_STATUS", event);
        safeSend(ws, "SIP_STATUS;OK");
        return;
    }

    // =========================
    // Unknown command
    // =========================
    logger(`Unhandled WS message from ${ws.ext || "unregistered"}: ${msg}`);
    safeSend(ws, "ERROR;UNKNOWN_COMMAND");
}

// =========================
// Helper functions
// =========================

function safeSend(ws, message) {
    try {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    } catch (e) {
        logger(`WARN: Failed to send WS message: ${e.message}`);
    }
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

    logger(`Ext=${ext}.SocketNotOpen`);
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
    sendTo,
    broadcast
};
