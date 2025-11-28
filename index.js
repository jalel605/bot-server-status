const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Gamedig = require('gamedig');
const http = require('http'); // مكتبة لإبقاء الخدمة تعمل في Render
require('dotenv').config();

// Load environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SERVER_IP = process.env.SERVER_IP; // مثال: "57.129.66.21:27015"
const SERVER_COUNTRY = process.env.SERVER_COUNTRY || 'Unknown'; 
// متغير بيئة جديد خاص بالمنفذ
const SERVER_PORT = process.env.SERVER_PORT || 10000; 

if (!BOT_TOKEN || !CHANNEL_ID || !SERVER_IP) {
    console.error("Missing environment variables (BOT_TOKEN, CHANNEL_ID, SERVER_IP)");
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
    console.log(`Checking server status for ${SERVER_IP}...`);
    try {
        const [ip, port] = SERVER_IP.split(':');
        const state = await Gamedig.query({
            type: 'cs16', 
            host: ip,
            port: parseInt(port)
        });

        const countryInfo = getCountryFlag(SERVER_COUNTRY);

        const embed = new EmbedBuilder()
            .setColor(state.maxplayers > state.players.length ? 0x00FF00 : 0xFF0000)
            .setTitle(state.name)
            .setURL(`steam://connect/${SERVER_IP}`)
            .setDescription(`**Connect:** \`steam://connect/${SERVER_IP}\``)
            .addFields(
                { name: 'Status', value: state.maxplayers > 0 ? '🟢 Online' : '🔴 Offline', inline: true },
                { name: 'Country', value: countryInfo, inline: true }, 
                { name: 'Address:Port', value: `\`${SERVER_IP}\``, inline: false },
                { name: 'Game', value: state.raw.game || 'Counter-Strike 1.6', inline: true },
                { name: 'Current Map', value: state.map, inline: true },
                { name: 'Players', value: `${state.players.length} / ${state.maxplayers} (${Math.round((state.players.length / state.maxplayers) * 100)}%)`, inline: false },
            )
            .setTimestamp()
            .setFooter({ text: `Last Update: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}` });
        
        // منطق تحديث الرسالة الواحدة
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
        const embed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('Server Status Monitor')
            .setDescription(`🔴 **Server is Offline or Unreachable**\n\n**IP:** \`${SERVER_IP}\``)
            .setTimestamp()
            .setFooter({ text: `Last checked: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}` });

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
// 🌐 خادم HTTP يستخدم SERVER_PORT لمنع الإغلاق في Render
// =========================================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running and monitoring the server status.\n');
});

// يستخدم SERVER_PORT
server.listen(SERVER_PORT, () => {
    console.log(`Web server running on port ${SERVER_PORT}`);
});const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Gamedig = require('gamedig');
const http = require('http'); // مكتبة لإبقاء الخدمة تعمل في Render
require('dotenv').config();

// Load environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SERVER_IP = process.env.SERVER_IP; // مثال: "57.129.66.21:27015"
const SERVER_COUNTRY = process.env.SERVER_COUNTRY || 'Unknown'; 
// متغير بيئة جديد خاص بالمنفذ
const SERVER_PORT = process.env.SERVER_PORT || 10000; 

if (!BOT_TOKEN || !CHANNEL_ID || !SERVER_IP) {
    console.error("Missing environment variables (BOT_TOKEN, CHANNEL_ID, SERVER_IP)");
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
    console.log(`Checking server status for ${SERVER_IP}...`);
    try {
        const [ip, port] = SERVER_IP.split(':');
        const state = await Gamedig.query({
            type: 'cs16', 
            host: ip,
            port: parseInt(port)
        });

        const countryInfo = getCountryFlag(SERVER_COUNTRY);

        const embed = new EmbedBuilder()
            .setColor(state.maxplayers > state.players.length ? 0x00FF00 : 0xFF0000)
            .setTitle(state.name)
            .setURL(`steam://connect/${SERVER_IP}`)
            .setDescription(`**Connect:** \`steam://connect/${SERVER_IP}\``)
            .addFields(
                { name: 'Status', value: state.maxplayers > 0 ? '🟢 Online' : '🔴 Offline', inline: true },
                { name: 'Country', value: countryInfo, inline: true }, 
                { name: 'Address:Port', value: `\`${SERVER_IP}\``, inline: false },
                { name: 'Game', value: state.raw.game || 'Counter-Strike 1.6', inline: true },
                { name: 'Current Map', value: state.map, inline: true },
                { name: 'Players', value: `${state.players.length} / ${state.maxplayers} (${Math.round((state.players.length / state.maxplayers) * 100)}%)`, inline: false },
            )
            .setTimestamp()
            .setFooter({ text: `Last Update: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}` });
        
        // منطق تحديث الرسالة الواحدة
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
        const embed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('Server Status Monitor')
            .setDescription(`🔴 **Server is Offline or Unreachable**\n\n**IP:** \`${SERVER_IP}\``)
            .setTimestamp()
            .setFooter({ text: `Last checked: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}` });

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
// 🌐 خادم HTTP يستخدم SERVER_PORT لمنع الإغلاق في Render
// =========================================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running and monitoring the server status.\n');
});

// يستخدم SERVER_PORT
server.listen(SERVER_PORT, () => {
    console.log(`Web server running on port ${SERVER_PORT}`);
});