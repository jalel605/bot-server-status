// index.js (الكود الذي يجمع منطقك وحل استقرار Render)
const Gamedig = require('gamedig');
const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http'); // ⬅️ الإضافة الضرورية للاستقرار
require('dotenv').config();

// --- 1. المتغيرات الأساسية ---
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const BOT_TOKEN = process.env.BOT_TOKEN; // Bot Token
const CHANNEL_ID = process.env.CHANNEL_ID; // ID القناة
const GAME_TYPE = 'cs16'; 
const POLLING_INTERVAL = 20000; // 20 ثانية
const RENDER_PORT = process.env.RENDER_PORT || 10000; // ⬅️ منفذ الاستقرار

// --- 2. متغيرات حالة التتبع ---
let lastMap = null; 
let lastServerFullStatus = false; 
let statusMessage = null; // الكائن الذي يحمل الرسالة لتعديلها مباشرة

// --- 3. تهيئة عميل Discord ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// --- 4. دالة بناء حمولة الرسالة (Embed) ---
function createStatusPayload(state, isOffline = false) {
    // ... (منطق بناء الرسالة كما أرسلته)
    const color = isOffline ? 0xFF0000 : 0x00FF00; 
    const playerList = isOffline ? 'N/A' : (state.players.map(p => p.name || 'N/A').join('\n') || 'No players online.');

    const embed = {
        color: color,
        title: isOffline ? `🚨 Server Offline 🚨` : `🔥 ${state.name}`,
        description: `**Connect:** steam://connect/${SERVER_IP}:${SERVER_PORT}`,
        fields: [
            { name: 'Status', value: isOffline ? '🔴 Offline' : '🟢 Online', inline: true },
            { name: 'Address:Port', value: `${SERVER_IP}:${SERVER_PORT}`, inline: true },
            { name: 'Current Map', value: isOffline ? 'N/A' : state.map, inline: true },
            { name: 'Players', value: isOffline ? '0 / 0' : `${state.players.length} / ${state.maxplayers}`, inline: true },
            { name: 'Player List', value: playerList, inline: false }
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'System Powered by GlaD | Last Update' 
        }
    };
    
    return {
        embeds: [embed]
    };
}

// --- 5. دالة الإرسال/التعديل (باستخدام Bot Client) ---
async function sendOrEditMessage(payload) {
    // ... (منطق الإرسال والتعديل)
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) {
        console.error(`Channel with ID ${CHANNEL_ID} not found or inaccessible.`);
        return;
    }
    
    if (statusMessage) {
        try {
            statusMessage = await channel.messages.fetch(statusMessage.id);
            await statusMessage.edit(payload);
            console.log("Successfully edited the status message.");
            return;
        } catch (error) {
            console.error("Failed to edit existing message. Sending new one...", error.message);
            statusMessage = null;
        }
    }
    
    try {
        statusMessage = await channel.send(payload);
        console.log(`Successfully sent new message. ID: ${statusMessage.id}`);
    } catch (error) {
        console.error("Failed to send new message. Check bot permissions.", error.message);
    }
}


// --- 6. دالة المراقبة الرئيسية (المنطق الصارم) ---
async function updateServerStatus() {
    // ... (منطق الاستعلام وتحديث الرسالة)
    let currentState = null;
    let isOffline = false;

    try {
        currentState = await Gamedig.query({
            type: GAME_TYPE,
            host: SERVER_IP,
            port: SERVER_PORT
        });
    } catch (error) {
        isOffline = true;
    }

    let shouldUpdate = false;
    
    if (!isOffline) {
        const currentMap = currentState.map;
        const maxPlayers = currentState.maxplayers;
        const isCurrentlyFull = (currentState.players.length >= maxPlayers);
        
        const mapChanged = currentMap !== lastMap;
        const fullStatusChanged = lastServerFullStatus !== isCurrentlyFull;

        // تحديث إذا تغيرت الخريطة، حالة الامتلاء، أو لأول مرة.
        shouldUpdate = mapChanged || fullStatusChanged || statusMessage === null;

        lastMap = currentMap;
        lastServerFullStatus = isCurrentlyFull;
    } else {
        // تحديث إذا كان Offline وكانت آخر حالة له Online أو لا توجد رسالة.
        if (lastMap !== null || statusMessage === null) {
            shouldUpdate = true; 
            lastMap = null;
            lastServerFullStatus = false;
        }
    }

    if (!shouldUpdate && statusMessage) {
        console.log("No required state change. Skipping update.");
        return;
    }
    
    const payload = createStatusPayload(currentState, isOffline);
    await sendOrEditMessage(payload);
}

// --- 7. تشغيل البوت والجدولة ---
client.on('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}!`);
    console.log(`Starting monitoring for ${SERVER_IP}:${SERVER_PORT}`);
    
    updateServerStatus(); 
    setInterval(updateServerStatus, POLLING_INTERVAL); 
});

client.login(BOT_TOKEN).catch(err => {
    console.error("Failed to log in to Discord. Check your BOT_TOKEN:", err.message);
});

// =========================================================
// 7.5 خادم HTTP لمنع الإغلاق (ضروري لـ Render)
// =========================================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running and monitoring the server status.\n');
});

server.listen(RENDER_PORT, () => {
    console.log(`Web server running on port ${RENDER_PORT}`);
});