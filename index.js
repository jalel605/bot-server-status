const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Gamedig = require('gamedig');
const http = require('http'); 
require('dotenv').config();

// =========================================================
// ✅ متغيرات Render (يجب ضبطها في لوحة التحكم)
// =========================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SERVER_IP = process.env.SERVER_IP; // ⬅️ الآن سيكون IP فقط: 57.129.61.75
const GAME_QUERY_PORT = process.env.SERVER_PORT; // ⬅️ الآن سيكون المنفذ فقط: 27015
const SERVER_COUNTRY = process.env.SERVER_COUNTRY || 'Unknown'; 

// المنفذ الخاص بخادم Render لضمان الاستقرار (يجب أن يكون 10000)
const RENDER_STABILITY_PORT = process.env.PORT || 10000; 

if (!BOT_TOKEN || !CHANNEL_ID || !SERVER_IP || !GAME_QUERY_PORT) {
    console.error("Missing environment variables (BOT_TOKEN, CHANNEL_ID, SERVER_IP, SERVER_PORT)");
    process.exit(1);
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

let messageId = null; 

const getCountryFlag = (countryCode) => {
    const flags = {
        'RO': '🇷🇴 Romania',
        'GR': '🇬🇷 Greece', 
        'US': '🇺🇸 USA',
        'GB': '🇬🇧 UK',
        'DE': '🇩🇪 Germany' 
    };
    return flags[countryCode.toUpperCase()] || '🌍 Unknown Location';
};

async function updateServerStatus() {
    console.log(`Checking server status for ${SERVER_IP}:${GAME_QUERY_PORT}...`);
    try {
        
        // =========================================================
        // ✅ استخدام المتغيرات المنفصلة مباشرة للاستعلام
        // =========================================================
        const state = await Gamedig.query({
            type: 'cs16', 
            host: SERVER_IP, // IP فقط
            port: parseInt(GAME_QUERY_PORT) // المنفذ فقط
        });

        const countryInfo = getCountryFlag(SERVER_COUNTRY);
        const Full_IP_Port = `${SERVER_IP}:${GAME_QUERY_PORT}`;

        const embed = new EmbedBuilder()
            .setColor(state.maxplayers > state.players.length ? 0x00FF00 : 0xFF0000)
            .setTitle(state.name)
            .setURL(`steam://connect/${Full_IP_Port}`)
            .setDescription(`**Connect:** \`steam://connect/${Full_IP_Port}\``)
            .addFields(
                { name: 'Status', value: state.maxplayers > 0 ? '🟢 Online' : '🔴 Offline', inline: true },
                { name: 'Country', value: countryInfo, inline: true }, 
                { name: 'Address:Port', value: `\`${Full_IP_Port}\``, inline: false },
                { name: 'Game', value: state.raw.game || 'Counter-Strike 1.6', inline: true },
                { name: 'Current Map', value: state.map, inline: true },
                { name: 'Players', value: `${state.players.length} / ${state.maxplayers} (${Math.round((state.players.length / state.maxplayers) * 100)}%)`, inline: false },
            )
            .setTimestamp()
            .setFooter({ text: `System Powered by GlaD | Last Update: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}` });
        
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) return console.error("Channel not found.");
        
        if (messageId) {
            try {
                const message = await channel.messages.fetch(messageId);
                await message.edit({ embeds: [embed] });
            } catch (error) {
                const newMessage = await channel.send({ embeds: [embed] });
                messageId = newMessage.id;
            }
        } else {
            const newMessage = await channel.send({ embeds: [embed] });
            messageId = newMessage.id;
        }

    } catch (error) {
        // حالة السيرفر متوقف أو غير قابل للوصول
        console.error(`Error querying server ${SERVER_IP}:${GAME_QUERY_PORT}: ${error.message}`);
        
        const Full_IP_Port = `${SERVER_IP}:${GAME_QUERY_PORT}`;
        const embed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('Server Status Monitor')
            .setDescription(`🔴 **Server is Offline or Unreachable**\n\n**IP:** \`${Full_IP_Port}\``)
            .setTimestamp()
            .setFooter({ text: `System Powered by GlaD | Last checked: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}` });

        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel) {
            if (messageId) {
                try {
                    const message = await channel.messages.fetch(messageId);
                    await message.edit({ embeds: [embed] });
                } catch (editError) {
                    const newMessage = await channel.send({ embeds: [embed] });
                    messageId = newMessage.id;
                }
            } else {
                const newMessage = await channel.send({ embeds: [embed] });
                messageId = newMessage.id;
            }
        }
    }
}

client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}!`);
    updateServerStatus();
    setInterval(updateServerStatus, 20000); 
});

client.login(BOT_TOKEN).catch(err => {
    console.error(`Failed to log in to Discord. Check your BOT_TOKEN: ${err.message}`);
    process.exit(1);
});

// =========================================================
// 🌐 خادم HTTP يستخدم المنفذ الخاص بـ Render (10000)
// =========================================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running and monitoring the server status.\n');
});

server.listen(RENDER_STABILITY_PORT, () => {
    console.log(`Web server running on port ${RENDER_STABILITY_PORT}`);
});