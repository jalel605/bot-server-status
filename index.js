// index.js
const Gamedig = require('gamedig');
const axios = require('axios');
require('dotenv').config();

const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; 
const GAME_TYPE = 'cs16';

let lastMessageId = null; // لتخزين ID آخر رسالة تم إرسالها

// دالة لبناء محتوى رسالة Webhook
function createStatusPayload(state, isOffline = false) {
    const color = isOffline ? 16711680 : (state.raw.password ? 16753920 : 65280); // FFB000 or 00FF00 or FF0000

    // بناء الـ Embed
    const embed = {
        color: color,
        title: isOffline ? `🚨 Server Offline 🚨` : `🔥 ${state.name}`,
        description: `**Connect:** steam://connect/${SERVER_IP}:${SERVER_PORT}`,
        fields: [
            { name: 'Status', value: isOffline ? '🔴 Offline' : '🟢 Online', inline: true },
            { name: 'Address:Port', value: `${SERVER_IP}:${SERVER_PORT}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'System Powered by GlaD | Last Update'
        }
    };

    if (!isOffline) {
        embed.fields.push(
            { name: 'Current Map', value: state.map, inline: true },
            { name: 'Players', value: `${state.players.length} / ${state.maxplayers}`, inline: true },
            { name: 'Player List', value: state.players.map(p => p.name || 'N/A').join('\n') || 'No players online.', inline: false }
        );
    }
    
    return {
        embeds: [embed]
    };
}

async function updateServerStatus() {
    let currentState = null;
    let isOffline = false;

    // 1. الاستعلام عن السيرفر
    try {
        currentState = await Gamedig.query({
            type: GAME_TYPE,
            host: SERVER_IP,
            port: SERVER_PORT
        });
    } catch (error) {
        console.error('Server is offline or unreachable:', error.message);
        isOffline = true;
    }

    // 2. إعداد حمولة الرسالة
    const payload = createStatusPayload(currentState, isOffline);

    // 3. حذف الرسالة القديمة (إن وجدت)
    if (lastMessageId) {
        try {
            // Webhook Delete Endpoint: [WEBHOOK_URL]/messages/[MESSAGE_ID]
            const deleteUrl = `${WEBHOOK_URL}/messages/${lastMessageId}`;
            await axios.delete(deleteUrl);
            console.log(`Successfully deleted previous message: ${lastMessageId}`);
            lastMessageId = null;
        } catch (error) {
            console.error('Could not delete previous message:', error.response ? error.response.status : error.message);
            // نستمر في الإرسال حتى لو فشل الحذف لتجنب التوقف التام
        }
    }

    // 4. إرسال الرسالة الجديدة
    try {
        const response = await axios.post(WEBHOOK_URL, payload);
        lastMessageId = response.data.id; // حفظ ID الرسالة الجديدة
        console.log(`Successfully sent new message. ID: ${lastMessageId}`);
    } catch (error) {
        console.error('Failed to send Webhook message:', error.response ? error.response.data : error.message);
    }
}

// دالة البدء
function startMonitor() {
    console.log('Starting server monitor...');
    // تشغيل التحديث الفوري عند البدء
    updateServerStatus(); 
    // تشغيل التحديث الدوري كل 10 ثوانٍ
    setInterval(updateServerStatus, 10000); 
}

startMonitor();