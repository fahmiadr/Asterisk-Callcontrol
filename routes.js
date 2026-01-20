const express = require("express");
const router = express.Router();
const asterisk = require("./AsteriskCC");
const asteriskAri = require("./AsteriskAri");
const logger = require("./Module/logger");
const ws = require("./websocket");

// === API QUEUE SUMMARY ===
router.post("/queueSummary", async (req, res) => {
    try {
        const { queue } = req.body;
        logger(`REQUEST.QUEUE.SUMMARY.QUEUE=${queue}`);
        const data = await asterisk.queueSummary(queue);
        res.json({ success: true, queue, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API QUEUE SUMMARY ===
router.post("/queueStatus", async (req, res) => {
    try {
        const { queue } = req.body;
        logger(`REQUEST.QUEUE.STATUS.QUEUE=${queue}`);
        const data = await asterisk.queueStatus(queue);
        res.json({ success: true, queue, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API QUEUE DASHBOARD ===
router.post("/dashboard", async (req, res) => {
    try {
        const { queue } = req.body;
        logger(`REQUEST.DASHBOARD=${queue}`);
        const data2 = await asterisk.queueSummary(queue);
        const data = await asterisk.queueStatus(queue);
        res.json({ success: true, queue, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// === API HOLD ===
router.post("/hold", async (req, res) => {
    const { extension, hold } = req.body;
    logger(`REQUEST.HOLD.EXTENSION=${extension},Msg=${hold}`);
    try {
        //const data = await asterisk.AgentHold(extension, hold);
        //const data = await asteriskAri.holdChannel(extension);
        const data = await ws.sendTo(extension,"Hold;");
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API Answer ===
router.post("/answer", async (req, res) => {
    const { extension, hold } = req.body;
    logger(`REQUEST.ANSWER.EXTENSION=${extension},Msg=${hold}`);
    try {
        //const data = await asterisk.AgentHold(extension, hold);
        //const data = await asteriskAri.holdChannel(extension);
        const data = await ws.sendTo(extension,"Answer;");
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API Hangup ===
router.post("/hangup", async (req, res) => {
    const { extension, hold } = req.body;
    logger(`REQUEST.HANGUP.EXTENSION=${extension},Msg=${hold}`);
    try {
        //const data = await asterisk.AgentHold(extension, hold);
        //const data = await asteriskAri.holdChannel(extension);
        const data = await ws.sendTo(extension,"Hangup;");
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API Transfer ===
router.post("/transfer", async (req, res) => {
    const { extension, msg } = req.body;
    logger(`REQUEST.TRANSFER.EXTENSION=${extension},Msg=${msg}`);
    try {
        //const data = await asterisk.AgentHold(extension, hold);
        //const data = await asteriskAri.holdChannel(extension);
        const data = await ws.sendTo(extension,msg);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API Conference ===
router.post("/conference", async (req, res) => {
    const { extension, msg } = req.body;
    logger(`REQUEST.TRANSFER.EXTENSION=${extension},Msg=${msg}`);
    try {
        //const data = await asterisk.AgentHold(extension, hold);
        //const data = await asteriskAri.holdChannel(extension);
        const data = await ws.sendTo(extension,msg);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API DIAL ===
router.post("/dial", async (req, res) => {
    const { extension, msg } = req.body;
    logger(`REQUEST.DIAL.EXTENSION=${extension},Msg=${msg}`);
    try {
        const data = await ws.sendTo(extension,msg);
        //const data = await asterisk.AgentDial(extension, dial);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API PAUSE ===
router.post("/pause", async (req, res) => {
    const { extension, queue, state, reason } = req.body;
    logger(`REQUEST.PAUSE.EXTENSION=${extension},QUEUE=${queue},STATE=${state},REASON=${reason}`);
    try {
        const data = await asterisk.AgentPause(extension, queue, state, reason);
        res.json({ success: true, queue, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.post("/pauseMultiSkill", async (req, res) => {
    const { extension, queues, state, reason } = req.body;

    if (!Array.isArray(queues) || !queues.length) {
        return res.status(400).json({
            success: false,
            message: "queues must be array"
        });
    }

    logger(
        `REQUEST.PAUSE.EXT=${extension},QUEUES=${queues.join(',')},STATE=${state},REASON=${reason}`
    );

    const results = [];

    for (const queue of queues) {
        try {
            const data = await asterisk.AgentPause(extension, queue, state, reason);
            results.push({ queue, success: true, data });
        } catch (err) {
            results.push({ queue, success: false, error: err.message });
        }
    }

    res.json({
        success: true,
        extension,
        state,
        results
    });
});

// === API LOGIN ===
router.post("/login", async (req, res) => {
    const { extension, queue } = req.body;
    logger(`REQUEST.LOGIN.EXTENSION=${extension},QUEUE=${queue}`);
    try {
        const data = await asterisk.AgentLogin(extension, queue);
        res.json({ success: true, queue, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.post("/loginMultiSkill", async (req, res) => {
    const { extension, queues } = req.body;

    if (!Array.isArray(queues) || !queues.length) {
        return res.status(400).json({
            success: false,
            message: "queues must be array"
        });
    }

    logger(`REQUEST.LOGIN.EXT=${extension},QUEUES=${queues.join(',')}`);

    const results = [];

    for (const queue of queues) {
        try {
            const data = await asterisk.AgentLogin(extension, queue);
            results.push({ queue, success: true, data });
        } catch (err) {
            results.push({ queue, success: false, error: err.message });
        }
    }

    res.json({
        success: true,
        extension,
        results
    });
});

// === API LOGOUT ===
router.post("/logout", async (req, res) => {
    const { extension, queue } = req.body;
    logger(`REQUEST.LOGOUT.EXTENSION=${extension},QUEUE=${queue}`);
    try {
        const data = await asterisk.AgentLogout(extension, queue);
        res.json({ success: true, queue, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.post("/logoutMultiSkill", async (req, res) => {
    const { extension, queues } = req.body;

    if (!Array.isArray(queues) || !queues.length) {
        return res.status(400).json({
            success: false,
            message: "queues must be array"
        });
    }

    logger(`REQUEST.LOGOUT.EXT=${extension},QUEUES=${queues.join(',')}`);

    const results = [];

    for (const queue of queues) {
        try {
            const data = await asterisk.AgentLogout(extension, queue);
            results.push({ queue, success: true, data });
        } catch (err) {
            results.push({ queue, success: false, error: err.message });
        }
    }

    res.json({
        success: true,
        extension,
        results
    });
});


// === Get Extension by IP ===
router.post("/getExtension", async (req, res) => {
    const { ip } = req.body;

    logger(`REQUEST.GET.EXTENSION.BY.IP=${ip}`);

    try {
        const data = await asterisk.GetExtensionByIp(ip);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === Get ACW Value ===
router.post("/getAcw", async (req, res) => {
    const { extension, queue } = req.body;

    logger(`REQUEST.GET.ACW.EXT=${extension},QUEUE=${queue}`);

    try {
        const data = await asterisk.GetAcwValue(extension, queue);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === Get All PJSIP Endpoints ===
router.post("/endpoints", async (req, res) => {
    logger(`REQUEST.GET.ALL.ENDPOINTS`);
    try {
        const data = await asterisk.GetAllEndpoints();
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === Web Socket ===


module.exports = router;
