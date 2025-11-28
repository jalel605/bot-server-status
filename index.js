// index.js (باستخدام discord.js و Bot Token)
const Gamedig = require('gamedig');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// --- 1. المتغيرات الأساسية ---
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const BOT_TOKEN = process.env.BOT_TOKEN; // Bot Token
const CHANNEL_ID = process.env.CHANNEL_ID; // ID القناة
const GAME_TYPE = 'cs16'; 
const POLLING_INTERVAL = 20000; // 20 ثانية

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
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) {
        console.error(`Channel with ID ${CHANNEL_ID} not found or inaccessible.`);
        return;
    }
    
    // الخيار أ: محاولة تعديل الرسالة الموجودة
    if (statusMessage) {
        try {
            await statusMessage.edit(payload);
            console.log("Successfully edited the status message.");
            return;
        } catch (error) {
            // إذا فشل التعديل (مثلاً، حُذفت الرسالة)، نُصفر statusMessage وننتقل للإرسال
            console.error("Failed to edit existing message. Sending new one...", error.message);
            statusMessage = null;
        }
    }
    
    // الخيار ب: إرسال رسالة جديدة
    try {
        statusMessage = await channel.send(payload);
        console.log(`Successfully sent new message. ID: ${statusMessage.id}`);
    } catch (error) {
        console.error("Failed to send new message. Check bot permissions.", error.message);
    }
}


// --- 6. دالة المراقبة الرئيسية (المنطق الصارم) ---
async function updateServerStatus() {
    let currentState = null;
    let isOffline = false;

    // 6.1 الاستعلام عن السيرفر
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
        
        // الشروط الصارمة للتحديث
        const mapChanged = currentMap !== lastMap;
        const fullStatusChanged = lastServerFullStatus !== isCurrentlyFull;

        // تحديث فقط عند تغير الخريطة أو حالة الامتلاء
        shouldUpdate = mapChanged || fullStatusChanged;

        // تحديث متغيرات التتبع
        lastMap = currentMap;
        lastServerFullStatus = isCurrentlyFull;
    } else {
        // إذا كان السيرفر Offline، يجب أن نحدث الرسالة إذا كانت آخر حالة له Online
        if (lastMap !== null) {
            shouldUpdate = true; 
            lastMap = null;
            lastServerFullStatus = false;
        }
    }

    // إرسال التحديث في حالتين:
    // 1. إذا كان هناك تحديث مطلوب.
    // 2. إذا لم تكن هناك رسالة موجودة لتعديلها (أول مرة تشغيل).
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
    
    // تشغيل التحديث الأول فوراً
    updateServerStatus(); 
    
    // جدولة الفحص كل 20 ثانية
    setInterval(updateServerStatus, POLLING_INTERVAL); 
});

client.login(BOT_TOKEN).catch(err => {
    console.error("Failed to log in to Discord. Check your BOT_TOKEN:", err.message);
});