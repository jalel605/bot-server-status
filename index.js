// index.js
const Gamedig = require('gamedig');
const axios = require('axios');
require('dotenv').config();

// --- 1. المتغيرات الأساسية ---
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; 
const GAME_TYPE = 'cs16'; 
const POLLING_INTERVAL = 20000; // 20 ثانية

// --- 2. متغيرات حالة التتبع (للتحديث المشروط) ---
let lastMap = null; 
let lastServerFullStatus = false; 
let lastPlayersHash = ''; // لتتبع قائمة اللاعبين
let lastMessageId = null; // لحفظ ID الرسالة المرسلة لحذفها لاحقاً

// --- 3. دالة بناء حمولة الرسالة (Embed) ---
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
            text: 'Game Server Monitor | Last Update'
        }
    };
    
    return {
        embeds: [embed]
    };
}

// --- 4. دالة الحذف والإرسال (التحديث) - الحل لمشكلة الحذف ---
async function sendUpdate(payload) {
    // 4.1 محاولة حذف الرسالة القديمة أولاً
    if (lastMessageId) {
        try {
            // Webhook Delete Endpoint: [WEBHOOK_URL]/messages/[MESSAGE_ID]
            const deleteUrl = `${WEBHOOK_URL}/messages/${lastMessageId}`;
            await axios.delete(deleteUrl);
            console.log(`Successfully deleted previous message: ${lastMessageId}`);
        } catch (error) {
            // تسجيل الخطأ ولكن عدم التوقف
            console.error('Could not delete previous message. Error status:', error.response ? error.response.status : error.message);
        }
    }
    lastMessageId = null;
    
    // 4.2 إرسال الرسالة الجديدة
    try {
        const response = await axios.post(WEBHOOK_URL, payload);
        
        // التحقق من الاستجابة وحفظ ID الرسالة الجديدة
        if (response.data && response.data.id) {
            lastMessageId = response.data.id; 
            console.log(`Successfully sent new message. ID: ${lastMessageId}`);
        } else {
             console.error("Sent message, but failed to retrieve message ID for next deletion.");
             lastMessageId = null; 
        }

    } catch (error) {
        console.error('Failed to send Webhook message. Check your WEBHOOK_URL. Error:', error.response ? error.response.data : error.message);
    }
}


// --- 5. دالة مراقبة حالة السيرفر الرئيسية (منطق التحديث المشروط) ---
async function updateServerStatus() {
    let currentState = null;
    let isOffline = false;

    // 5.1 الاستعلام عن السيرفر
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
        
        // Hash قائمة اللاعبين لتحديد ما إذا كان لاعب قد دخل أو خرج
        const playersHash = currentState.players.map(p => p.name).sort().join('|');

        // شروط التحديث:
        const mapChanged = currentMap !== lastMap;
        const fullStatusChanged = lastServerFullStatus !== isCurrentlyFull;
        const playerListChanged = playersHash !== lastPlayersHash; // تحديث عند دخول أو خروج لاعب

        shouldUpdate = mapChanged || fullStatusChanged || playerListChanged;

        // تحديث متغيرات حالة التتبع
        lastMap = currentMap;
        lastServerFullStatus = isCurrentlyFull;
        lastPlayersHash = playersHash;
    } else {
        // إذا كان Offline، دائماً نحدث لتسجيل حالة الانقطاع
        shouldUpdate = true;
    }

    if (!shouldUpdate) {
        console.log("No required state change. Skipping update.");
        return;
    }
    
    // 5.3 بناء وإرسال التحديث
    const payload = createStatusPayload(currentState, isOffline);
    await sendUpdate(payload);
}

// --- 6. دالة البدء ---
function startMonitor() {
    console.log('Starting game server monitor...');
    
    // تشغيل التحديث الفوري عند البدء
    updateServerStatus(); 
    
    // تشغيل التحديث الدوري
    setInterval(updateServerStatus, POLLING_INTERVAL); 
}

startMonitor();