import { createRequire } from "module";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const require = createRequire(import.meta.url);
const BinanceModule = require("binance-api-node");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const Binance = BinanceModule.default;

const binanceClient = Binance({
  httpBase: "https://api3.binance.com",
  httpFutures: "https://fapi.binance.com",
  wsBase: "wss://stream.binance.com:9443/ws/",
  wsFutures: "wss://fstream.binance.com/ws/",
  timeout: 10000,
  keepAlive: true,
});

export async function testBinanceConnection() {
  try {
    await binanceClient.ping();
    console.log("Binance API connection successful");
    return true;
  } catch (error) {
    console.error("Binance API connection failed:", error.message);
    return false;
  }
}

export async function getMarketData(symbol) {
  try {
    const ticker = await binanceClient.dailyStats({ symbol });
    return ticker;
  } catch (error) {
    if (
      error.message.includes("connect") ||
      error.message.includes("timeout")
    ) {
      throw new Error(
        `Failed to connect to Binance API (api3.binance.com): ${error.message}`,
      );
    }
    throw new Error(
      `Failed to get market data for ${symbol}: ${error.message}`,
    );
  }
}

export async function getCandlestickData(symbol, interval = "1h", limit = 100) {
  try {
    const candles = await binanceClient.candles({
      symbol,
      interval,
      limit,
    });

    return candles.map((candle) => ({
      openTime: candle.openTime,
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume),
      closeTime: candle.closeTime,
    }));
  } catch (error) {
    if (
      error.message.includes("connect") ||
      error.message.includes("timeout")
    ) {
      throw new Error(
        `Failed to connect to Binance API (api3.binance.com): ${error.message}`,
      );
    }
    throw new Error(
      `Failed to get candlestick data for ${symbol}: ${error.message}`,
    );
  }
}

function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[prices.length - i] - prices[prices.length - i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function getTechnicalIndicators(candleData) {
  const closePrices = candleData.map((c) => c.close);
  const volumes = candleData.map((c) => c.volume);

  const currentPrice = closePrices[closePrices.length - 1];
  const sma20 = calculateSMA(closePrices, 20);
  const sma50 = calculateSMA(closePrices, 50);
  const rsi = calculateRSI(closePrices);

  const priceChange =
    closePrices.length > 1
      ? ((currentPrice - closePrices[closePrices.length - 2]) /
          closePrices[closePrices.length - 2]) *
        100
      : 0;

  const recent24h = candleData.slice(-24);
  const high24h = Math.max(...recent24h.map((c) => c.high));
  const low24h = Math.min(...recent24h.map((c) => c.low));

  const avgVolume =
    volumes.slice(-20).reduce((a, b) => a + b, 0) /
    Math.min(20, volumes.length);
  const currentVolume = volumes[volumes.length - 1];

  return {
    currentPrice,
    priceChange,
    sma20,
    sma50,
    rsi,
    high24h,
    low24h,
    currentVolume,
    avgVolume,
    volumeRatio: currentVolume / avgVolume,
  };
}

function generateTradingSignal(indicators) {
  const { currentPrice, sma20, sma50, rsi, priceChange, volumeRatio } =
    indicators;

  let signal = "NEUTRAL";
  let strength = 0;
  let reasons = [];

  if (sma20 && sma50) {
    if (currentPrice > sma20 && sma20 > sma50) {
      strength += 2;
      reasons.push("Price above SMA20 & SMA20 > SMA50 (Bullish trend)");
    } else if (currentPrice < sma20 && sma20 < sma50) {
      strength -= 2;
      reasons.push("Price below SMA20 & SMA20 < SMA50 (Bearish trend)");
    }
  }

  if (rsi) {
    if (rsi > 70) {
      strength -= 1;
      reasons.push(`RSI ${rsi.toFixed(1)} - Overbought zone`);
    } else if (rsi < 30) {
      strength += 1;
      reasons.push(`RSI ${rsi.toFixed(1)} - Oversold zone`);
    } else if (rsi > 50) {
      strength += 0.5;
      reasons.push(`RSI ${rsi.toFixed(1)} - Bullish momentum`);
    } else {
      strength -= 0.5;
      reasons.push(`RSI ${rsi.toFixed(1)} - Bearish momentum`);
    }
  }

  if (volumeRatio > 1.5) {
    strength += 0.5;
    reasons.push("High volume activity");
  } else if (volumeRatio < 0.7) {
    strength -= 0.5;
    reasons.push("Low volume activity");
  }

  if (priceChange > 2) {
    strength += 1;
    reasons.push(`Strong positive momentum (+${priceChange.toFixed(2)}%)`);
  } else if (priceChange < -2) {
    strength -= 1;
    reasons.push(`Strong negative momentum (${priceChange.toFixed(2)}%)`);
  }

  if (strength >= 2) {
    signal = "BUY";
  } else if (strength <= -2) {
    signal = "SELL";
  } else if (strength > 0) {
    signal = "WEAK BUY";
  } else if (strength < 0) {
    signal = "WEAK SELL";
  }

  return { signal, strength, reasons };
}

export async function getTradingAnalysis(symbol) {
  try {
    const marketData = await getMarketData(symbol);
    const candleData = await getCandlestickData(symbol, "1h", 100);
    const indicators = getTechnicalIndicators(candleData);
    const tradingSignal = generateTradingSignal(indicators);

    const analysisData = {
      symbol,
      currentPrice: indicators.currentPrice,
      priceChange24h: parseFloat(marketData.priceChangePercent),
      volume24h: parseFloat(marketData.volume),
      high24h: indicators.high24h,
      low24h: indicators.low24h,
      sma20: indicators.sma20,
      sma50: indicators.sma50,
      rsi: indicators.rsi,
      tradingSignal: tradingSignal.signal,
      signalStrength: tradingSignal.strength,
      signalReasons: tradingSignal.reasons,
    };

    const prompt = `
Analisa data trading berikut untuk ${symbol} dan berikan analisis teknikal dalam bahasa Indonesia:

Data Market:
Harga saat ini: $${analysisData.currentPrice}
Perubahan 24h: ${analysisData.priceChange24h}%
Volume 24h: ${analysisData.volume24h}
High 24h: $${analysisData.high24h}
Low 24h: $${analysisData.low24h}

Indikator Teknikal:
SMA 20: ${analysisData.sma20 ? "$" + analysisData.sma20.toFixed(2) : "N/A"}
SMA 50: ${analysisData.sma50 ? "$" + analysisData.sma50.toFixed(2) : "N/A"}
RSI: ${analysisData.rsi ? analysisData.rsi.toFixed(1) : "N/A"}

Sinyal Trading: ${analysisData.tradingSignal}
Kekuatan Sinyal: ${analysisData.signalStrength}
Alasan: ${analysisData.signalReasons.join(", ")}

Berikan analisis dalam format poin sederhana:
1. Kondisi market saat ini
2. Trend harga dan momentum  
3. Sinyal buy/sell/hold
4. Level risk dan stop loss
5. Target harga jika ada

Jawab dalam poin-poin singkat tanpa formatting dan tanpa emoji.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ text: prompt }],
    });

    return response.text;
  } catch (error) {
    throw new Error(`Failed to generate trading analysis: ${error.message}`);
  }
}

export async function getTopMovers() {
  try {
    const tickers = await binanceClient.dailyStats();

    const usdtPairs = tickers.filter(
      (ticker) =>
        ticker.symbol.endsWith("USDT") && parseFloat(ticker.volume) > 1000000,
    );

    const sorted = usdtPairs.sort(
      (a, b) =>
        parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent),
    );

    const gainers = sorted.slice(0, 5);
    const losers = sorted.slice(-5).reverse();

    return { gainers, losers };
  } catch (error) {
    throw new Error(`Failed to get top movers: ${error.message}`);
  }
}

export async function getMarketSentiment() {
  try {
    const { gainers, losers } = await getTopMovers();
    const btcData = await getMarketData("BTCUSDT");
    const ethData = await getMarketData("ETHUSDT");

    const prompt = `
Analisa sentimen market crypto berdasarkan data berikut:

Bitcoin (BTC):
Harga: $${parseFloat(btcData.lastPrice).toFixed(2)}
Perubahan 24h: ${parseFloat(btcData.priceChangePercent).toFixed(2)}%

Ethereum (ETH):
Harga: $${parseFloat(ethData.lastPrice).toFixed(2)}
Perubahan 24h: ${parseFloat(ethData.priceChangePercent).toFixed(2)}%

Top Gainers (24h):
${gainers.map((coin, i) => `${i + 1}. ${coin.symbol}: +${parseFloat(coin.priceChangePercent).toFixed(2)}%`).join("\n")}

Top Losers (24h):
${losers.map((coin, i) => `${i + 1}. ${coin.symbol}: ${parseFloat(coin.priceChangePercent).toFixed(2)}%`).join("\n")}

Berikan analisis sentimen market dalam bahasa Indonesia dengan format poin sederhana:
1. Kondisi market secara umum
2. Sentimen dominan bullish/bearish/netral
3. Faktor utama yang mempengaruhi
4. Prediksi jangka pendek

Jawab dalam poin-poin singkat tanpa formatting dan tanpa emoji.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ text: prompt }],
    });

    return response.text;
  } catch (error) {
    throw new Error(`Failed to analyze market sentiment: ${error.message}`);
  }
}