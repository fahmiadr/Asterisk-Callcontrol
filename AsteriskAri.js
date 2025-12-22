const AriClient = require('ari-client');
const config = require('./config.json');
const logger = require('./Module/logger');
const myAsteriskCC = require('./AsteriskCC');

// Konfigurasi ARI
const ARI_URL = config.ARI.URL;
const ARI_USER = config.ARI.Username;
const ARI_PASS = config.ARI.Password;

let ari = null;

async function initARI() {
    if (ari) return ari;

    ari = await AriClient.connect(ARI_URL, ARI_USER, ARI_PASS);
    logger("ARI connected");

    // Optional: listen Hold/Unhold events
    ari.on("ChannelHold", evt => logger(`🎧 HOLD EVENT:", ${JSON.stringify(evt)}`));
    ari.on("ChannelUnhold", evt => logger(`🎧 UNHOLD EVENT:", ${JSON.stringify(evt)}`));

    /*
    ari.on("StasisStart", (event, channel) => {
        logger(`🚀 STASIS START: ${JSON.stringify(event)}`);
        try {
            // Retrieve channel (mandatory di ARI setelah Stasis)
            const ch = ari.Channel(channel.id);

            // Optional: otomatis answer (bisa diganti logic)
            ch.answer((err) => {
                if (err) logger(`❌ Error answer: ${err.message}`);
                else logger("☎️ Channel answered");
            });
        } catch (err) {
            logger(`❌ STASIS ERROR: ${err.message}`);
        }
    });    
    */

    ari.start('app');
    
    return ari;
}

function registerEvents(thisAri) {
    ari = thisAri;

    ari.on("StasisStart", async (event, channel) => {
        logger(`[ARI.EVENT] StasisStart: ${channel.id}, Args=${event.args}`);

        const args = event.args || [];

        if (args[0] !== "dialed") {

            // ================= CALLER SIDE =================
            const exten = "1005";
            const tech  = `PJSIP/${exten}`;
            
            logger(`[CALLER] ${channel.caller.number} dialing ${exten}`);

            // Buat Bridge
            const bridge = ari.Bridge();
            await bridge.create({type: "mixing", name: "callbridge"});

            // Cache bridge for later usage
            channel._bridge = bridge.id;

            // Add caller
            await bridge.addChannel({channel: channel.id});

            // Originate call
            await ari.channels.originate({
                endpoint: tech,
                app: "app",
                appArgs: "dialed",     // penting!
                callerId: channel.caller.number
            });

        } else {

            // ================= CALLEE SIDE =================
            logger(`[CALLEE] Channel answered: ${channel.id}`);

            // Jawab callee (1005)
            ari.channels.answer({channel: channel.id});

            
            // Cari channel caller untuk menemukan bridge id
            const channels = await ari.channels.list();

            const cleanChannels = channels.map(c => ({
                id: c.id,
                name: c.name,
                state: c.state,
                caller: c.caller,
                connected: c.connected,
                tech: c.name.split('/')[0], // contoh parsing tech: PJSIP
            }));

            logger(`Channels=${JSON.stringify(cleanChannels, null, 2)}`)
            // Cari channel dengan argumen bukan dialed
            const caller = channels.find(c => c.id !== channel.id && c.state === "Up");

            /*
            logger(`Caller=${JSON.stringify(caller, null, 2)}`)
            if (!caller || !caller._bridge) {
                logger(`⚠ Bridge not found to add callee`);
                return;
            }
            

            const bridge = ari.Bridge(caller._bridge);

            // Tambahkan callee ke bridge
            await bridge.addChannel({channel: channel.id});

            logger(`🔗 Caller and Callee connected in bridge ${caller._bridge}`);
            */

            // Cek apakah caller sudah masuk bridge
            let bridgeId = caller.bridge || caller.bridged || caller._bridge;

            let bridge;

            if (bridgeId) {
            // Jika sudah ada bridge, gunakan
            bridge = ari.Bridge(bridgeId);
            } else {
            // Kalau belum ada, buat bridge baru
            bridge = ari.Bridge();
            await bridge.create({ type: "mixing", name: "AutoBridge" });

            // Tambahkan caller
            await bridge.addChannel({ channel: caller.id });
            logger(`🎯 Caller ditambahkan ke bridge baru: ${bridge.id}`);
            }

            // Tambahkan callee (yang baru datang) ke bridge
            await bridge.addChannel({ channel: channel.id });

            logger(`🔗 Caller dan Callee tersambung dalam bridge ${bridge.id}`);
            
        }
    });


    /*
    ari.on("StasisStart", async (event, channel) => {
        logger(`[ARI.EVENT]:STASISSTART.Channel=${channel.id}`);
        logger(`[ARI.EVENT]:Event=${JSON.stringify(event)}`);
        //channel.answer();

        const exten = 1005;//event.dialplan.exten;//event.args[0];       // "1005"
        const tech = "PJSIP/" + exten;     // PJSIP/1005

        logger(`[ARI.EVENT]:Call to ${exten}, origin from ${channel.caller.number},Tech=${tech},ChannelId=${channel.id}`);

        // Buat Bridge
        const bridge = ari.Bridge();
        await bridge.create({type: "mixing", name: "callbridge"});

        // Join caller ke bridge
        await bridge.addChannel({channel: channel.id});

        // Dial Endpoint
        const dialed = await ari.channels.originate({
            endpoint: tech,
            app: "callcontrol",
            appArgs: "dialed",
            callerId: channel.caller.number
        });

        ari.channels.answer({channel: channel.id});
 
        
        // Saat dia menjawab, hubungkan
        ari.on("StasisStart", async (evt, ch) => {
            if (evt.args[0] === "dialed") {
                await bridge.addChannel({channel: ch.id});
            }
        });
        
    });
    */
    


    ari.on("ChannelDestroyed", (event) => {
        logger(`[EVENT] Channel destroyed: ${event.channel.id}`);
    });

    logger("ARI Events loaded");
};

function holdChannel(channelId) {
    if (!ari) initARI();

    let myExt=channelId;
    channelId=myAsteriskCC.agentsData[channelId].channel;

    logger(`⏸ HOLD Extension=${myExt} ,Channel=${channelId}`);
    return ari.channels.mohStart({ channelId });
}

async function unholdChannel(channelId, bridgeId = null) {
    if (!ari) await initARI();

    let myChannel = myAsteriskCC.agentsData[channelId].channel;

    logger(`▶️ UNHOLD Ext=${channelId} Channel = ${myChannel}`);
    await ari.channels.mohStop({ myChannel });

    if (bridgeId) {
        logger(`🔄 Re-add to Bridge = ${bridgeId}`);
        try {
            await ari.bridges.addChannel({
                bridgeId,
                channel: myChannel
            });
        } catch (err) {
            logger(`⚠ Tidak bisa add ke bridge lagi: ${err.message}`);
        }
    }
}

module.exports={
    initARI,
    registerEvents,
    holdChannel,
    unholdChannel
}