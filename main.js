const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const Boom = require('@hapi/boom');
const qrcode = require('qrcode-terminal'); // Add qrcode-terminal
const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.API_KEY
});

// Generate a response from OpenAI
async function generateResponse(prompt) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Token-efficient model
            messages: [
                { "role": "system", "content": 
                    `
                    You're a bot for a company (Caawiye Bots) that makes AI bots for businesses:

                    1. Our services:
                        We make efficient and advanced AI bots for businesses to help improve their customer service.
                    2. Our billing plans:
                        We offer monthly at $30 and yearly at $300.
                    3. Benefits of our AI bots:
                        - Helps improve customer service for businesses.
                        - Makes businesses available 24/7.
                    4.if customer ask where your comany located at :
                        - now we are virtually online
                    5.if customer asks a person or real person :
                        -let them now we call them asap or give it my number : +252611430930.
                    6
                    . If the customer agrees to the plan or wants a bot:
                        Let them know we will call them later to confirm their order and ask more about their custom bot. Thank them!
                    
                    Make sure you respond in Somali to each question appropriately.
                    `
                },
                { "role": "user", "content": prompt }
            ]
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error generating response:", error);
        return "Sorry, there was an issue generating a response.";
    }
}

// Load auth state (creds and keys)
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');  // Save creds in the 'auth_info' folder

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Generate and display QR code if provided
        if (qr) {
            qrcode.generate(qr, { small: true });  // Display QR code in the terminal
        }

        if (connection === 'close') {
            const shouldReconnect = Boom.isBoom(lastDisconnect.error) && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
            // console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();  // Reconnect if not logged out
            }
        } else if (connection === 'open') {
            // console.log('opened connection');
        }
    });

    // Handle credentials update and persist them
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message || message.key.fromMe) return; // Ignore if there's no message or if it's from the bot itself

        const userId = message.key.remoteJid;
        const prompt = message.message.conversation || message.message.extendedTextMessage?.text || '';

        // Generate AI response
        const responseText = await generateResponse(prompt);

        // Send the AI response back to the user
        await sock.sendMessage(userId, { text: responseText });
    });
}

// Run WhatsApp connection on app startup
connectToWhatsApp();
