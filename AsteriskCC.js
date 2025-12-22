const AsteriskAmi = require('asterisk-ami-client');
const logger = require('./Module/logger');
const config = require('./config.json');
const myFunc = require('./Function');
const { PrepareStatementInfo } = require('mysql2');

let ami = null;
let agentsData = {};

let reconnecting = false;

let myDashboard = {
    abandoned:0,
    completed:0,
    queue:0, 
    queueCalls:0,
    incall:0,
    login:0,
    ready:0,
    notready:0,
    serviceLevel:0
}

function saveAgentEvent(event) {
    if(!event.MemberName) return false;
    if(event.MemberName.trim()==='') return false;
    if(!event.Interface) return false;
    if(event.Interface.trim()==='') return false; 

    let flag=null;

    if(!agentsData[event.MemberName]){
        agentsData[event.MemberName] = {
            membername: event.MemberName,
            interface: event.Interface,
            timestamp: Date.now()
        };
        flag='Inserted';
    }

    if(agentsData[event.MemberName]){
        agentsData[event.MemberName].interface=event.Interface;
        agentsData[event.MemberName].timestamp=Date.now();
        flag='Updated'
    }

    logger(`[AgentEvent]:agentsData.Updated=${JSON.stringify(agentsData)}`)
}

function saveChannel(event) {
    if(!event.Channel) return false;
    if(event.Channel.trim()==='') return false;

    let flag=null;

    let ext=myFunc.getExtension(event.Channel);
    if(!agentsData[ext]){
        agentsData[ext] = {
            channel: event.Channel
        };
        flag='Inserted';
    }

    if(agentsData[ext]){
        agentsData[ext].channel=event.Channel;
        flag='Updated';
    }
    
    logger(`[AgentChannel]:agentsData.${flag}=${JSON.stringify(agentsData)}`)
}

function connectAMI() {
    try {
        ami = new AsteriskAmi({
            reconnect: true,            // aktifkan fitur reconnect
            keepAlive: true,
            maxReconnectAttempts: -1,   // -1 = unlimited reconnect
            reconnectDelay: config.AMI.reconnectDelay        // delay reconnect 3 detik
        });

        ami.connect(config.AMI.username, config.AMI.password, {
            host: config.AMI.host,
            port: config.AMI.port
        })
        .then(() => {
            logger("✅ Connected to AMI");
        })
        .catch(err => {
            logger("❌ Failed initial connection:", err);
        });

        ami.on('timeout', () => {
            logger("⚠️ AMI Timeout... reconnecting in 3s");

            setTimeout(() => {
                ami.connect(config.AMI.username, config.AMI.password, {
                    host: config.AMI.host,
                    port: config.AMI.port
                });
            }, 3000);
        });

        // Jika koneksi terputus (network drop, asterisk restart, dsb)
        ami.on('disconnect', () => {
            logger("⚠️ AMI Disconnected... trying to reconnect");
            scheduleReconnect();
        });

        // Saat konek berhasil
        ami.on('connect', () => {
            reconnecting = false;
            //logger(`✅ Connected to Asterisk AMI`);
        });

        ami.on('reconnecting', () => {
            logger("🔄 Reconnecting to AMI...");
        });

        ami.on('error', (err) => {
            logger("❌ AMI Error:", err);
            scheduleReconnect();
        });
        
        ami.on("uncaughtException", (err) => {
            logger(`🔥 UNCAUGHT EXCEPTION:${err.message}`);
        });

        ami.on("unhandledRejection", (reason) => {
            logger(`💥 UNHANDLED PROMISE REJECTION:${reason}`);
        });

        // Listen events
        ami.on('event', (event) => {
            logger(`Event=${event.Event}`);

            saveAgentEvent(event);
            saveChannel(event);

            const e = event.Event?.toLowerCase();
            const direction = 'inbound';//= detectDirection(event.channel);

            switch (e) {
                case 'newchannel':
                    //ringing
                    myFunc.postStatus('Ringing',event);
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                case 'bridgeenter':
                case 'link':
                    //Connected
                    myFunc.postStatus('Connected',event);
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                case 'hangup':
                    //hangup
                    myFunc.postStatus('Hangup',event);
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                case 'queuecallerabandon':
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                case 'agentringnoanswer':
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                case 'agentconnect':
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                case 'agentcomplete':
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                case 'queuesummary':
                    logger(`📊 Queue Summary Event.`);
                    break;
                case 'queuesummarycomplete':
                    logger(`✅ QueueSummary Completed`);
                    break;
                case 'requestbadformat':
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                case 'hold':
                    myFunc.postStatus('Hold',event);
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                case 'unhold':
                    myFunc.postStatus('Unhold',event);
                    logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
                    break;
                default:
                    break;
            }
        });
    } catch (error) {
        console.error('🚫 Failed to initialize AMI:', error.message);
        scheduleReconnect();
    }
}

// FUNCTION REQUEST DIAL
function AgentDial(extension,dialnumber) {
    return new Promise((resolve, reject) => {
        let result = null;

        logger(`REQUEST.AGENT.DIAL.EXT=${extension},DIAL=${dialnumber}`);
        ami.action({
            Action: 'Originate',
            Channel: `PJSIP/${extension}`,       // Agent di-call dulu
            Context: 'clicktocall',            // Routing setelah agent angkat
            Exten: dialnumber,             // Nomor customer
            Priority: 1,
            CallerID: `"Agent ${extension}" <${extension}>`,
            Timeout: 30000,
            Async: true
        }, (err, res) => {
            if (err) {
                logger(`ERROR=${err}`);
                return reject(err);
            }
        });

        // Success
        const message = `🔐 Agent ${extension},Dial=${dialnumber}`;

        logger(message);
        resolve({ success: true, response: message });
    });
}

// FUNCTION REQUEST HOLD, AGAK SULIT
function AgentHold(extension,hold) {
    return new Promise((resolve, reject) => {
        let result = null;

        logger(`REQUEST.AGENT.HOLD.EXT=${extension},HOLD=${hold},CHANNEL=${agentsData[extension].channel}`);
        ami.action({
            //Action:  'MuteAudio',                       //'SetMusicOnHold',                   //'BridgeMute',
            //Channel: agentsData[extension].channel,     //`PJSIP/${extension}`,       // contoh: 'SIP/1005-0000123'
            //Direction: 'both',
            //State: hold

            // New Methode
            Action: Command,
            Command: `channel request ${hold} ${agentsData[extension].channel}`

        }, (err, res) => {
            if (err) {
                logger(`ERROR=${err}`);
                return reject(err);
            }
        });

        // Success
        const message = `🔐 Agent ${extension},Channel=${agentsData[extension].channel},Hold=${hold}`;

        logger(message);
        resolve({ success: true, response: message });
    });
}

// FUNCTION REQUEST PAUSE
function AgentPause(extension,queue,state) {
    return new Promise((resolve, reject) => {
        let result = null;

        let myInterface=null;
        if(!agentsData[extension].interface) myInterface=`*45/${extension}@from-queue/n`;
        else myInterface=agentsData[extension].interface;

        logger(`REQUEST.AGENT.PAUSE.EXT=${extension},QUEUE=${queue},STATE=${state},Interface=${myInterface}`);

        if(state==='1'){
            logger(`REQUEST.AGENT.PAUSED=TRUE`);
            ami.action({
            Action: 'QueuePause',
            Interface: myInterface,
            Queue: queue,            // queue name
            Paused: 'true'            // pause
            }, (err, res) => {
                if (err) {
                    logger(`ERROR=${err}`);
                    return reject(err);
                }
            });
        }

        else if(state==='0'){
            logger(`REQUEST.AGENT.PAUSED=FALSE`);
            ami.action({
            Action: 'QueuePause',
            Interface: myInterface,
            Queue: queue,            // queue name
            Paused: 'false'           // pause
            }, (err, res) => {
                if (err) {
                    logger(`ERROR=${err}`);
                    return reject(err);
                }
            });
        }

        // Success
        const message = `🔐 Agent ${extension} Paused=${state} on Queue=${queue}`;

        logger(message);
        resolve({ success: true, response: message });
    });
}

// FUNCTION REQUEST LOGIN
function AgentLogin(extension,queue) {
    return new Promise((resolve, reject) => {
        let result = null;

        logger(`REQUEST.AGENT.LOGIN.LOGOUT.EXT=${extension},QUEUE=${queue}`);
        ami.action({
            Action: "QueueAdd",
            Queue: queue,
            Interface: `Local/${extension}@from-queue/n`,
            MemberName: extension,
            Paused: 1
        }, (err, res) => {
            if (err) {
                logger(`ERROR=${err}`);
                return reject(err);
            }
        });

        // Success
        const message = queue
            ? `🔐 Agent ${extension} LOGIN to QUEUE ${queue}`
            : `🔓 Agent ${extension} LOGOUT from QUEUE`;

        logger(message);
        resolve({ success: true, response: message });
    });
}

// FUNCTION REQUEST LOGOUT
function AgentLogout(extension,queue) {
    return new Promise((resolve, reject) => {
        let result = null;

        logger(`REQUEST.AGENT.LOGOUT.EXT=${extension},QUEUE=${queue}`);
        ami.action({
            Action: "QueueRemove",
            Queue: queue,
            Interface: `Local/${extension}@from-queue/n`,
            MemberName: extension
        }, (err, res) => {
            if (err) {
                logger(`ERROR=${err}`);
                return reject(err);
            }
        });

        // Success
        const message = queue
            ? `🔐 Agent ${extension} LOGOUT to QUEUE ${queue}`
            : `🔓 Agent ${extension} LOGOUT from QUEUE`;

        logger(message);
        resolve({ success: true, response: message });
    });
}

// FUNCTION REQUEST QUEUE SUMMARY
function queueSummary(queue) {
    return new Promise((resolve, reject) => {
        try{
        let result = null;

        let myResult={
            login:0,
            ready:0,
            notready:0
        }

        const handler = (event) => {
            if (event.Event === "QueueSummary" && event.Queue === queue) {
                logger(`result=${JSON.stringify(event, null, 2)}`);
                myResult.login=event.LoggedIn;
                myResult.ready=event.Available;
                result = event;
            }

            if (event.Event === "QueueSummaryComplete") {
                ami.removeListener("event", handler);
                logger(`result=${JSON.stringify(event, null, 2)}`);
                myDashboard.login=myResult.login;
                myDashboard.ready=myResult.ready;
                myDashboard.notready=(myResult.login-myResult.ready-myResult.incall||0);
                return resolve(result);
            }
        };

        ami.on("event", handler);

        logger(`REQUEST.QUEUE.SUMMARY.QUEUE=${queue}`);
        ami.action({
            Action: "QueueSummary",
            Queue: queue
        }, (err, res) => {
            if (err) {
                logger(`ERROR=${err}`);
                ami.removeListener("event", handler);
                return reject(err);
            }
        });
        
        setTimeout(() => {
            ami.removeListener("event", handler);
            reject("Timeout waiting QueueSummary");
        }, config.API.timeout);
     
    }catch(error){
        logger(`Error:QueueSummary.Error=${error.message}`);
        return reject(err.message);
    }
    });
}

const myResult = {
    queue:0,
    queueCalls:0,
    abandoned:0,
    completed:0,
    inCall:0,
    waiting:0,
    sl:0
};

let tempInCall=0;


// FUNCTION REQUETS QUEUE STATUS
function queueStatus(queue) {
    return new Promise((resolve, reject) => {
        try{
        let result = null;
       
        myResult.queue=queue;

        const handler = (event) => {
            if (event.Event === "QueueParams" && event.Queue === queue) {
                logger(`result=${JSON.stringify(event, null, 2)}`);
                result = event;
                myResult.abandoned=parseInt(event.Abandoned||0);
                myResult.completed=parseInt(event.Completed||0);
                myResult.sl=parseInt(event.ServiceLevel||0);
                myResult.queueCalls=parseInt(event.Calls||0);
            }

            if (event.Event === "QueueMember" && event.Queue === queue) {
                result = event;
                tempInCall+=parseInt(event.InCall||0);
                myResult.incall=tempInCall;
                logger(`InCall=${event.InCall},result=${JSON.stringify(event, null, 2)}`);
            }

            if (event.Event === "QueueStatusComplete") {
                ami.removeListener("event", handler);
                logger(`result=${JSON.stringify(event, null, 2)}`);

                myDashboard.queue=parseInt(myResult.queue||0);
                myDashboard.incall=parseInt(myResult.incall||0);
                myDashboard.serviceLevel=parseInt(myResult.sl||0);
                myDashboard.queueCalls=parseInt(myResult.queueCalls||0);
                myDashboard.abandoned=parseInt(myResult.abandoned||0);
                myDashboard.completed=parseInt(myResult.completed||0);

                myResult.incall=0;
                tempInCall=0;

                logger(`Dashboard=${JSON.stringify(myDashboard, null, 2)}`);

                return resolve(myDashboard);
            }
        };

        ami.on("event", handler);

        logger(`REQUEST.QUEUE.STATUS.QUEUE=${queue}`);
        ami.action({
            Action: "QueueStatus",
            Queue: queue
        }, (err, res) => {
            if (err) {
                logger(`ERROR=${err}`);
                ami.removeListener("event", handler);
                return reject(err);
            }
        });
        
        setTimeout(() => {
            ami.removeListener("event", handler);
            reject("Timeout waiting QueueSummary");
        }, config.API.timeout);
        
    }catch(error){
        logger(`Error:QueueSummary.Error=${error.message}`);
        return reject(err.message);
    }
    });
}

// Fungsi untuk reconnect otomatis
function scheduleReconnect() {
  if (reconnecting) return; // hindari double reconnect
  reconnecting = true;
  logger(`⏳ Reconnecting in ${config.AMI.reconnectDelay / 1000} seconds...`);

  connectAMI();
  /*
  setTimeout(() => {
    connectAMI();
  }, config.AMI.reconnectDelay);
  */
}

module.exports={
    connectAMI,
    queueSummary,
    queueStatus,
    AgentLogin,
    AgentLogout,
    AgentPause,
    AgentHold,
    AgentDial,
    agentsData
}