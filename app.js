const express = require("express");
const bodyParser = require("body-parser");
const asterisk = require('./AsteriskCC');
const logger = require('./Module/logger');
const createRoutes = require("./routes");
const asteriskARI = require("./AsteriskAri");
const agentRoutes = require("./routes");
const ws = require("./websocket");

const app = express();

app.use(express.json());

asterisk.connectAMI();

//ws.startWebSocketServer();

app.use("/",agentRoutes);

/*
; ARI
*/
//const myAri = asteriskARI.initARI();
//asteriskARI.registerEvents(myAri);
/*
(async () => {
    const myAri = await asteriskARI.initARI();
    asteriskARI.registerEvents(myAri);
})();
*/

// === RUN SERVER ===
const PORT = 4000;
app.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
});