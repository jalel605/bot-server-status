// index.js
const Gamedig = require('gamedig');
const axios = require('axios');
require('dotenv').config();

// --- 1. المتغيرات الأساسية ---
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; 
const GAME_TYPE = 'cs16'; 

// ✅ التعديل هنا: التوقيت 20 ثانية لضمان التقاط التغييرات فوراً
const POLLING_INTERVAL = 20000; 

// --- 2. متغيرات حالة التتبع ---
let lastMap = null; 
let lastServerFullStatus = false; 
let lastPlayersHash = ''; // نحافظ عليه لتتبع الحالة ولكن لا نستخدمه للتحديث المشروط
let lastMessageId = null; 

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

// --- 4. دالة الإرسال الذكي (Edit Mode) ---
async function sendUpdate(payload) {
    // الخيار أ: محاولة تعديل الرسالة الموجودة (PATCH)
    if (lastMessageId) {
        try {
            const editUrl = `${WEBHOOK_URL}/messages/${lastMessageId}`;
            await axios.patch(editUrl, payload);
            console.log(`Successfully edited message: ${lastMessageId}`);
            return;
        } catch (error) {
            console.error('Failed to edit message (maybe it was deleted?). Sending a new one...');
            lastMessageId = null;
        }
    }
    
    // الخيار ب: إرسال رسالة جديدة (POST) - يحدث فقط في البداية أو عند الخطأ
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


// --- 5. دالة المراقبة الرئيسية (المنطق الصارم) ---
async function updateServerStatus() {
    let currentState = null;
    let isOffline = false;

    // محاولة الاتصال بالسيرفر
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
        
        // Hash قائمة اللاعبين (نحتاجها فقط لتحديث المتغيرات الداخلية)
        const playersHash = currentState.players.map(p => p.name).sort().join('|');

        // ✅ الشروط الصارمة للتحديث
        const mapChanged = currentMap !== lastMap;
        const fullStatusChanged = lastServerFullStatus !== isCurrentlyFull;

        // تحديث فقط عند تغير الخريطة أو حالة الامتلاء
        shouldUpdate = mapChanged || fullStatusChanged;

        // تحديث متغيرات التتبع
        lastMap = currentMap;
        lastServerFullStatus = isCurrentlyFull;
        lastPlayersHash = playersHash;
    } else {
        // إذا كان السيرفر Offline، يجب أن نحدث الرسالة إذا كانت آخر حالة له Online
        if (lastMap !== null) {
            shouldUpdate = true; 
            // تحديث متغيرات التتبع إلى Null
            lastMap = null;
            lastServerFullStatus = false;
        }
    }

    // إرسال التحديث في حالتين:
    // 1. إذا كان هناك تحديث مطلوب (تغير الخريطة أو الامتلاء).
    // 2. إذا كانت هذه أول مرة للتشغيل (lastMessageId === null).
    if (!shouldUpdate && lastMessageId) {
        console.log("No required state change. Skipping update.");
        return;
    }
    
    const payload = createStatusPayload(currentState, isOffline);
    await sendUpdate(payload);
}

// --- 6. التشغيل ---
function startMonitor() {
    console.log(`Starting System Powered by GlaD (Strict Edit Mode)...`);
    
    // تشغيل التحديث الأول فوراً
    updateServerStatus(); 
    
    // جدولة الفحص كل 20 ثانية
    setInterval(updateServerStatus, POLLING_INTERVAL); 
}

startMonitor();