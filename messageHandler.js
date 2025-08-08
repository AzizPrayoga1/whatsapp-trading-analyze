import { GoogleGenAI } from "@google/genai";
import {
  getTradingAnalysis,
  getMarketData,
  getTopMovers,
  getMarketSentiment,
  testBinanceConnection,
} from "./trading.js";
import "dotenv/config";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

let modetrading = 0;
let geminiActive = false;

export async function handleMessage(msg) {
  const text = msg.body;
  const cmd = text.toLowerCase().trim().split(" ")[0];
  const prefix = "!";
  const args = text.slice(prefix.length).trim().split(/ +/).slice(1);

  switch (cmd) {
    case "!trading":
      await handleTradingCommand(msg, args);
      break;

    case "!gemini":
      await handleGeminiCommand(msg, args);
      break;

    case "!price":
      await handlePriceCommand(msg, args);
      break;

    case "!analyze":
      await handleAnalyzeCommand(msg, args);
      break;

    case "!top":
      await handleTopMoversCommand(msg);
      break;

    case "!sentiment":
      await handleSentimentCommand(msg);
      break;

    case "!test":
      await handleTestCommand(msg);
      break;

    case "!help":
      await handleHelpCommand(msg);
      break;
  }

  if (modetrading === 0 && !cmd.startsWith("!") && text.trim().length > 0) {
    await handleCasualMessage(msg);
  }

  if (msg.hasMedia) {
    await handleMediaMessage(msg);
  }
}

async function handleCasualMessage(msg) {
  if (!geminiActive) {
    return;
  }

  try {
    const funnyPrompt = `
Balas pesan ini dengan gaya yang lucu dan menghibur dalam bahasa Indonesia. Gunakan:
- Gaya bicara yang kocak dan santai
- Referensi meme atau hal viral yang lucu
- Jawaban yang kreatif dan tidak terduga
- Boleh pakai bahasa gaul yang natural
- 

Pesan yang harus dibalas: "${msg.body}"

Jawab maksimal 2-3 baris.
`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ text: funnyPrompt }],
    });

    msg.reply(response.text);
  } catch (error) {
    console.error("Error in casual message:", error);
    const fallbackResponses = [
      "Aduh maaf ya, otakku lagi error. Coba chat lagi deh!",
      "Eh sorry, lagi loading... 99%... masih loading...",
      "AI-nya lagi ngambek nih. Tunggu sebentar ya beb!",
      "System error detected! suara robot rusak beep boop beep",
      "Maaf lagi maintenance, silakan tekan F5... eh ini bukan website",
    ];
    const randomResponse =
      fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    msg.reply(randomResponse);
  }
}

async function handleGeminiCommand(msg, args) {
  if (args.length === 0) {
    msg.reply(
      `Usage: !gemini on atau off\n\nStatus saat ini: ${
        geminiActive ? "ON" : "OFF"
      }`,
    );
    return;
  }

  if (args[0] === "on") {
    geminiActive = true;
    msg.reply(
      "Gemini AI is now ON\n\nBot akan merespon chat dan gambar dengan AI!",
    );
  } else if (args[0] === "off") {
    geminiActive = false;
    msg.reply(
      "Gemini AI is now OFF\n\nBot hanya akan merespon command trading saja. Chat biasa tidak akan dibalas.",
    );
  } else {
    msg.reply(
      `Invalid argument. Use !gemini on atau off\n\nStatus saat ini: ${
        geminiActive ? "ON" : "OFF"
      }`,
    );
  }
}

async function handleTradingCommand(msg, args) {
  if (args.length === 0) {
    msg.reply(`Usage: !trading on atau off`);
    return;
  }

  if (args[0] === "on") {
    modetrading = 1;
    msg.reply(
      "Trading bot is now ON\n\nMode Serius Aktif!\n\nGunakan command:\n\u2022 !price [symbol] - Cek harga crypto\n\u2022 !analyze [symbol] - Analisis teknikal\n\u2022 !top - Top gainers/losers\n\u2022 !sentiment - Sentimen market\n\u2022 !help - Bantuan\n\nAI Model: Gemini 2.5 Pro",
    );
  } else if (args[0] === "off") {
    modetrading = 0;
    msg.reply(
      "Trading bot is now OFF\n\nMode Santai Aktif!\n\nSekarang bisa chat biasa dan bot akan bales dengan lucu! Chat apa aja atau kirim foto untuk komentar kocak!\n\nAI Model: Gemini 1.5 Flash",
    );
  } else {
    msg.reply(`Invalid argument. Use !trading on atau off`);
  }
}

async function handlePriceCommand(msg, args) {
  if (modetrading === 0) {
    msg.reply("Trading bot is OFF. Use !trading on to enable.");
    return;
  }

  if (args.length === 0) {
    msg.reply("Usage: !price [symbol]\nContoh: !price BTCUSDT");
    return;
  }

  const symbol = args[0].toUpperCase();
  try {
    const marketData = await getMarketData(symbol);
    const changeLabel =
      parseFloat(marketData.priceChangePercent) >= 0 ? "UP" : "DOWN";
    const priceInfo = `
${changeLabel} ${symbol} Market Data

Price: $${parseFloat(marketData.lastPrice).toFixed(2)}
24h Change: ${parseFloat(marketData.priceChangePercent).toFixed(2)}%
24h Volume: ${parseFloat(marketData.volume).toFixed(0)}
24h High: $${parseFloat(marketData.highPrice).toFixed(2)}
24h Low: $${parseFloat(marketData.lowPrice).toFixed(2)}

Last Update: ${new Date().toLocaleString("id-ID")}
    `;
    msg.reply(priceInfo);
  } catch (error) {
    msg.reply(`Error getting price for ${symbol}: ${error.message}`);
  }
}

async function handleAnalyzeCommand(msg, args) {
  if (modetrading === 0) {
    msg.reply("Trading bot is OFF. Use !trading on to enable.");
    return;
  }

  if (!geminiActive) {
    msg.reply("Gemini AI is OFF. Use !gemini on to enable AI analysis.");
    return;
  }

  if (args.length === 0) {
    msg.reply("Usage: !analyze [symbol]\nContoh: !analyze BTCUSDT");
    return;
  }

  const symbol = args[0].toUpperCase();
  try {
    msg.reply("Sedang menganalisis market data...");
    const analysis = await getTradingAnalysis(symbol);
    msg.reply(analysis);
  } catch (error) {
    msg.reply(`Error analyzing ${symbol}: ${error.message}`);
  }
}

async function handleTopMoversCommand(msg) {
  if (modetrading === 0) {
    msg.reply("Trading bot is OFF. Use !trading on to enable.");
    return;
  }

  try {
    msg.reply("Mengambil data top movers...");
    const { gainers, losers } = await getTopMovers();

    let response = "TOP MOVERS (24H)\n\n";

    response += "TOP GAINERS:\n";
    gainers.forEach((coin, i) => {
      response += `${i + 1}. ${coin.symbol}: +${parseFloat(
        coin.priceChangePercent,
      ).toFixed(2)}%\n`;
    });

    response += "\nTOP LOSERS:\n";
    losers.forEach((coin, i) => {
      response += `${i + 1}. ${coin.symbol}: ${parseFloat(
        coin.priceChangePercent,
      ).toFixed(2)}%\n`;
    });

    response += `\n${new Date().toLocaleString("id-ID")}`;

    msg.reply(response);
  } catch (error) {
    msg.reply(`Error getting top movers: ${error.message}`);
  }
}

async function handleSentimentCommand(msg) {
  if (modetrading === 0) {
    msg.reply("Trading bot is OFF. Use !trading on to enable.");
    return;
  }

  if (!geminiActive) {
    msg.reply("Gemini AI is OFF. Use !gemini on to enable AI analysis.");
    return;
  }

  try {
    msg.reply("Menganalisis sentimen market...");
    const sentiment = await getMarketSentiment();
    msg.reply(sentiment);
  } catch (error) {
    msg.reply(`Error analyzing market sentiment: ${error.message}`);
  }
}

async function handleTestCommand(msg) {
  try {
    msg.reply("Testing API connections...");

    const binanceStatus = await testBinanceConnection();

    let status = "API Connection Status\n\n";
    status += `Binance API (api3.binance.com): ${
      binanceStatus ? "Connected" : "Failed"
    }\n`;
    status += `Gemini AI: ${
      process.env.GEMINI_API_KEY ? "API Key Set" : "No API Key"
    }\n`;
    status += `Gemini Status: ${geminiActive ? "Active" : "Inactive"}\n`;

    if (binanceStatus) {
      try {
        const btcData = await getMarketData("BTCUSDT");
        status += `Sample BTC Price: $${parseFloat(btcData.lastPrice).toFixed(
          2,
        )}\n`;
      } catch (error) {
        status += `Sample request failed: ${error.message}\n`;
      }
    }

    status += `\n${new Date().toLocaleString("id-ID")}`;

    msg.reply(status);
  } catch (error) {
    msg.reply(`Error testing connections: ${error.message}`);
  }
}

async function handleHelpCommand(msg) {
  const helpText = `
Trading Bot Commands

General Commands:
 !trading on/off - Enable/disable trading mode
 !gemini on/off - Enable/disable Gemini AI responses
 !test - Test API connections
 !help - Show this help

Trading Commands: (trading mode must be ON)
 !price [symbol] - Get current price data
 !analyze [symbol] - Get technical analysis (requires Gemini ON)
 !top - Top gainers and losers (24h)
 !sentiment - Market sentiment analysis (requires Gemini ON)

Casual Chat Mode: (when trading mode is OFF & Gemini ON)
 Chat biasa akan dibalas dengan lucu menggunakan Gemini Flash
 Kirim foto/gambar untuk komentar lucu
 Bot akan jadi lebih santai dan menghibur

Examples:
 !price BTCUSDT
 !analyze ETHUSDT
 !top
 !sentiment
 !test
 !gemini on/off

Current Status:
 Trading Mode: ${modetrading ? "ON" : "OFF"}
 Gemini AI: ${geminiActive ? "ON" : "OFF"}

Supported symbols: All Binance trading pairs (e.g., BTCUSDT, ETHUSDT, BNBUSDT, etc.)

API Endpoint: api3.binance.com

AI Models:
 Trading mode: Gemini 2.5 Pro (serious analysis)
 Casual mode: Gemini 1.5 Flash (funny responses)
  `;
  msg.reply(helpText);
}

async function handleMediaMessage(msg) {
  if (!geminiActive) {
    return;
  }

  try {
    const media = await msg.downloadMedia();

    let prompt;
    let model;

    if (
      modetrading === 1 &&
      msg.body &&
      /chart|grafik|trading|analisis|candle|support|resistance|trend/i.test(
        msg.body,
      )
    ) {
      prompt = `Analisa gambar chart/grafik trading ini dalam bahasa Indonesia. Berikan analisis teknikal dalam format poin sederhana:
1. Kondisi chart saat ini
2. Tren yang terjadi
3. Level support dan resistance
4. Sinyal trading yang terlihat

Caption: ${msg.body}

Jawab dalam poin-poin singkat tanpa formatting dan tanpa emoji.`;
      model = "gemini-2.5-pro";
    } else {
      prompt = `Lihat gambar ini dan buat komentar yang lucu dan menghibur dalam bahasa Indonesia! Gunakan:
- Gaya bicara yang kocak dan santai
- Referensi meme atau hal viral
- Observasi yang kreatif dan tidak terduga
- Bahasa gaul yang natural

${msg.body ? `Caption: ${msg.body}` : ""}

Buat komentar maksimal 2-3 baris, .`;
      model = "gemini-1.5-flash";
    }

    const contents = [
      {
        inlineData: {
          mimeType: media.mimetype,
          data: media.data,
        },
      },
      {
        text: prompt,
      },
    ];

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
    });

    msg.reply(response.text);
  } catch (error) {
    console.error("Error processing media:", error);
    if (modetrading === 0) {
      const funnyFallbacks = [
        "Waduh fotonya keburu kabur nih. Kayak hantu lewat!",
        "Maaf ya, mata AI-ku lagi minus. Kirim foto yang HD dong!",
        "Error 404: Kemampuan lihat gambar not found",
        "Lagi rabun nih, kayak nenek-nenek. Coba foto yang cerah dong!",
        "System overload! Kebanyakan ketampanan di foto",
      ];
      const randomResponse =
        funnyFallbacks[Math.floor(Math.random() * funnyFallbacks.length)];
      msg.reply(randomResponse);
    } else {
      msg.reply("Maaf, terjadi kesalahan saat memproses media.");
    }
  }
}

export { modetrading, geminiActive };