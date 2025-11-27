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

// --- 2. متغيرات حالة التتبع ---
let lastMap = null; 
let lastServerFullStatus = false; 
let lastPlayersHash = ''; 
let lastMessageId = null; // سنستخدم هذا لتعديل الرسالة بدلاً من حذفها

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
            text: 'System Powered by GlaD | Last Update' 
        }
    };
    
    return {
        embeds: [embed]
    };
}

// --- 4. دالة الإرسال الذكي (Edit instead of Delete/Post) ---
async function sendUpdate(payload) {
    // الخيار أ: إذا كان لدينا ID رسالة سابقة، نحاول تعديلها (PATCH)
    if (lastMessageId) {
        try {
            // Webhook Edit Endpoint: [WEBHOOK_URL]/messages/[MESSAGE_ID]
            const editUrl = `${WEBHOOK_URL}/messages/${lastMessageId}`;
            await axios.patch(editUrl, payload);
            console.log(`Successfully edited message: ${lastMessageId}`);
            return; // نخرج من الدالة لأننا انتهينا
        } catch (error) {
            console.error('Failed to edit message (maybe deleted?). Sending a new one...');
            // إذا فشل التعديل (مثلاً الرسالة حذفت)، نجعل الـ ID فارغاً لنرسل واحدة جديدة
            lastMessageId = null;
        }
    }
    
    // الخيار ب: إرسال رسالة جديدة (POST) - يحدث في أول مرة أو عند الخطأ
    try {
        const response = await axios.post(WEBHOOK_URL, payload);
        
        if (response.data && response.data.id) {
            lastMessageId = response.data.id; 
            console.log(`Successfully sent new message. ID: ${lastMessageId}`);
        } else {
             console.error("Sent message, but failed to retrieve message ID.");
        }
    } catch (error) {
        console.error('Failed to send Webhook message:', error.message);
    }
}


// --- 5. دالة المراقبة والتحديث المشروط ---
async function updateServerStatus() {
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
        const playersHash = currentState.players.map(p => p.name).sort().join('|');

        const mapChanged = currentMap !== lastMap;
        const fullStatusChanged = lastServerFullStatus !== isCurrentlyFull;
        const playerListChanged = playersHash !== lastPlayersHash;

        shouldUpdate = mapChanged || fullStatusChanged || playerListChanged;

        lastMap = currentMap;
        lastServerFullStatus = isCurrentlyFull;
        lastPlayersHash = playersHash;
    } else {
        // إذا تغيرت الحالة من Online إلى Offline (أو العكس) نحتاج للتحديث
        shouldUpdate = true; 
    }

    // ملاحظة: إذا كانت الرسالة غير موجودة (بداية التشغيل)، يجب أن نرسل حتى لو لم تتغير الحالة
    if (!shouldUpdate && lastMessageId) {
        console.log("No required state change. Skipping update.");
        return;
    }
    
    const payload = createStatusPayload(currentState, isOffline);
    await sendUpdate(payload);
}

// --- 6. التشغيل ---
function startMonitor() {
    console.log('Starting System Powered by GlaD (Edit Mode)...');
    updateServerStatus(); 
    setInterval(updateServerStatus, POLLING_INTERVAL); 
}

startMonitor();