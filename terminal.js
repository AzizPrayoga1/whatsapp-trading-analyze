import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { handleMessage } from "./messageHandler.js";

class WhatsAppClient {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
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
  }

  initialize() {
    return this.client.initialize();
  }

  getClient() {
    return this.client;
  }
}

export default WhatsAppClient;
