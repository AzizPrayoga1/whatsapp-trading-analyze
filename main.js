import WhatsAppClient from "./terminal.js";
import { testBinanceConnection } from "./trading.js";
import "dotenv/config";

console.log("Starting Trading Bot...");

const whatsappClient = new WhatsAppClient();

async function start() {
  try {
    console.log("Testing Binance API connection...");
    await testBinanceConnection();

    await whatsappClient.initialize();
    console.log("Trading Bot is running!");
    console.log("Scan the QR code with WhatsApp to connect");
    console.log("\nAvailable commands:");
    console.log("   !trading on/off - Enable/disable trading mode");
    console.log("   !price [symbol] - Get crypto price");
    console.log("   !analyze [symbol] - Get technical analysis");
    console.log("   !top - Top gainers/losers");
    console.log("   !sentiment - Market sentiment");
    console.log("   !help - Show help menu");
    console.log("\nUsing Binance API: https://api3.binance.com");
  } catch (error) {
    console.error("Failed to start bot:", error);
    
    if (error.message.includes("libatk") || error.message.includes("chrome")) {
      console.error("\n=== SERVER SETUP REQUIRED ===");
      console.error("It looks like you're running on a headless server.");
      console.error("Please run the setup script: ./setup-server.sh");
      console.error("Or see SERVER-SETUP.md for manual installation steps.");
      console.error("==============================\n");
    }
    
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  console.log("\nShutting down bot gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down bot gracefully...");
  process.exit(0);
});

start();
