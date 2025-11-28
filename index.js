// index.js
const Gamedig = require('gamedig');
const axios = require('axios');
require('dotenv').config();

// --- 1. المتغيرات الأساسية ---
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; 
const GAME_TYPE = 'cs16'; 

// ✅ التعديل هنا: التوقيت 5 دقائق (5 * 60 * 1000 = 300000 ميلي ثانية)
const POLLING_INTERVAL = 300000; 

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

// --- 4. دالة الإرسال الذكي (Edit Mode) ---
async function sendUpdate(payload) {
    // الخيار أ: محاولة تعديل الرسالة الموجودة (PATCH)
    if (lastMessageId) {
        try {
            // Webhook Edit Endpoint: [WEBHOOK_URL]/messages/[MESSAGE_ID]
            const editUrl = `${WEBHOOK_URL}/messages/${lastMessageId}`;
            await axios.patch(editUrl, payload);
            console.log(`Successfully edited message: ${lastMessageId}`);
            return; // نخرج بنجاح، لا داعي لإرسال رسالة جديدة
        } catch (error) {
            console.error('Failed to edit message (maybe it was deleted?). Sending a new one...');
            // إذا فشل التعديل (مثلاً الرسالة حذفت يدوياً)، نصفر الـ ID لنرسل جديدة
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


// --- 5. دالة المراقبة الرئيسية ---
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

    // ملاحظة: مع التعديل (Edit)، نفضل التحديث دائماً حتى لو لم تتغير الحالة
    // لكي يتحدث الوقت (Last Update) في التذييل، ولضمان دقة المعلومات كل 5 دقائق.
    // إذا كنت تريد تقليل الطلبات أكثر، يمكنك إعادة تفعيل شروط (shouldUpdate).
    
    const payload = createStatusPayload(currentState, isOffline);
    await sendUpdate(payload);
}

// --- 6. التشغيل ---
function startMonitor() {
    console.log(`Starting System Powered by GlaD (Update every 5 mins)...`);
    
    // تشغيل التحديث الأول فوراً
    updateServerStatus(); 
    
    // جدولة التحديث كل 5 دقائق
    setInterval(updateServerStatus, POLLING_INTERVAL); 
}

startMonitor();