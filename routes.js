const express = require("express");
const router = express.Router();
const asterisk = require("./AsteriskCC");
const asteriskAri = require("./AsteriskAri");
const logger = require("./Module/logger");

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
    logger(`REQUEST.HOLD.EXTENSION=${extension},HOLD=${hold}`);
    try {
        //const data = await asterisk.AgentHold(extension, hold);
        const data = await asteriskAri.holdChannel(extension);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API DIAL ===
router.post("/dial", async (req, res) => {
    const { extension, dial } = req.body;
    logger(`REQUEST.DIAL.EXTENSION=${extension},DIAL=${dial}`);
    try {
        
        const data = await asterisk.AgentDial(extension, dial);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// === API PAUSE ===
router.post("/pause", async (req, res) => {
    const { extension, queue, state } = req.body;
    logger(`REQUEST.PAUSE.EXTENSION=${extension},QUEUE=${queue},STATE=${state}`);
    try {
        const data = await asterisk.AgentPause(extension, queue, state);
        res.json({ success: true, queue, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
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

// === Web Socket ===


module.exports = router;
