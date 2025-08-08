import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { handleMessage } from "./messageHandler.js";

class WhatsAppClient {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on("qr", (qr) => {
      console.log("Scan QR code:");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      console.log("WhatsApp Client is ready!");
    });

    this.client.on("message", async (msg) => {
      try {
        await handleMessage(msg);
      } catch (error) {
        console.error("Error handling message:", error);
        msg.reply("Terjadi kesalahan saat memproses pesan Anda.");
      }
    });

    this.client.on("disconnected", (reason) => {
      console.log("Client was disconnected:", reason);
    });

    this.client.on("auth_failure", (msg) => {
      console.error("Authentication failed:", msg);
    });

    this.client.on("loading_screen", (percent, message) => {
      console.log("Loading screen:", percent, message);
    });
  }

  initialize() {
    return this.client.initialize();
  }

  getClient() {
    return this.client;
  }
}

export default WhatsAppClient;
