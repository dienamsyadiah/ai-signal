# AI Signal Generator - OpenAI Integration

## Overview
The `/api/signal` endpoint integrates OpenAI API to generate structured trading signals based on real market data and technical analysis.

## Architecture

### 1. Data Flow
```
User Request → API Route → Market Data Fetch → Technical Analysis → AI Signal Generation → Structured Response
```

### 2. Key Components

#### A. Market Data (`lib/market-data.ts`)
- Fetches real-time OHLC candles from Twelve Data API
- Supports multiple timeframes (M15, H1, H4)
- Supports multiple symbols (EURUSD, GBPUSD, USDJPY, XAUUSD)
- Includes caching to avoid rate limits (5-minute revalidation)

#### B. Technical Indicators (`lib/indicators.ts`)
- **SMA (Simple Moving Average)**: 20 and 50 periods
- **RSI (Relative Strength Index)**: 14-period
- **ATR (Average True Range)**: 14-period for volatility
- **Support/Resistance**: Swing high/low detection (20-candle lookback)
- **Trend Detection**: Up/Down/Sideways based on price vs SMAs

#### C. AI Signal Generation (`app/api/signal/route.ts`)
Uses OpenAI's GPT-4o model with structured output via the AI SDK.

## AI Prompt Structure

The AI receives:
- **Market Data**: Symbol, timeframe, last close price
- **Technical Indicators**: Trend, SMA20/50, RSI, ATR, support/resistance levels
- **Trading Preferences**: Style (Scalping/Swing), Risk Profile (Conservative/Moderate/Aggressive)
- **Account Info** (optional): Account size, max risk percentage

## Output Schema (Zod Validation)

```typescript
{
  bias: "BUY" | "SELL" | "WAIT",           // Trading direction
  entry: {
    type: "Market" | "Limit" | "Stop",      // Order type
    price: number                            // Entry price
  },
  stopLoss: number,                         // REQUIRED - Risk management
  takeProfit: [number, number],             // Two targets [TP1, TP2]
  confidence: 0-1,                          // AI confidence level
  rationale: string[],                      // 3-5 bullet points explaining the signal
  riskNotes: string[]                       // 3-5 risk warnings
}
```

## Guardrails & Risk Management

### 1. Mandatory Stop Loss
- The AI MUST always provide a stop loss
- Schema validation enforces this requirement
- Stop loss calculated based on ATR (volatility):
  - **Conservative**: 1x ATR
  - **Moderate**: 1.5x ATR
  - **Aggressive**: 2x ATR

### 2. WAIT Option
The AI is instructed to choose "WAIT" when:
- Setup is unclear or conflicting signals present
- Risk-reward ratio is not favorable
- Market conditions don't match the trading style

### 3. No Profit Promises
- AI is instructed to never guarantee profits
- All responses must avoid absolute language
- Disclaimer automatically added to every signal:
  > "⚠️ DISCLAIMER: This is NOT financial advice. Trade at your own risk."

### 4. Risk-Reward Requirements
- Minimum 1.5:1 risk-reward ratio for TP1
- Two take profit levels for partial profit-taking
- Proper price ordering validation:
  - **BUY**: stopLoss < entry < takeProfit
  - **SELL**: stopLoss > entry > takeProfit

## Environment Variables Required

```env
# OpenAI API (handled automatically by Vercel AI Gateway)
# No API key needed - uses Vercel's AI Gateway by default

# Market Data Provider
MARKET_DATA_PROVIDER=TWELVE_DATA
TWELVE_DATA_API_KEY=your_api_key_here
```

## API Usage Example

### Request
```typescript
POST /api/signal
Content-Type: application/json

{
  "symbol": "EURUSD",
  "timeframe": "H1",
  "style": "Swing",
  "riskProfile": "Moderate",
  "accountSize": 10000,      // Optional
  "maxRiskPercent": 2        // Optional
}
```

### Response
```json
{
  "id": "sig_1234567890_abc123xyz",
  "symbol": "EURUSD",
  "timeframe": "H1",
  "style": "Swing",
  "risk": "Moderate",
  "signal": "BUY",
  "confidence": 78,
  "entryPrice": 1.09450,
  "entryType": "Market",
  "tp1": 1.09800,
  "tp2": 1.10100,
  "stopLoss": 1.09150,
  "rationale": [
    "Price trading above both SMA20 and SMA50, indicating strong uptrend",
    "RSI at 58 shows bullish momentum without being overbought",
    "Recent support level at 1.09150 provides clear stop loss placement"
  ],
  "riskNotes": [
    "Always use proper position sizing based on your account size",
    "Monitor price action near resistance at 1.10100",
    "Consider taking partial profits at TP1 and moving stop to breakeven",
    "⚠️ DISCLAIMER: This is NOT financial advice. Trade at your own risk."
  ],
  "timestamp": "2025-01-10T12:34:56.789Z",
  "technical": {
    "trend": "up",
    "rsi": 58.3,
    "atr": 0.00300,
    "support": 1.09150,
    "resistance": 1.10100
  }
}
```

## Error Handling

The API handles various error scenarios:

1. **Missing API Key**: Returns 503 with clear error message
2. **Rate Limits**: Returns 429 with retry instructions
3. **Invalid API Key**: Returns 401 with key validation error
4. **No Market Data**: Returns 503 when data unavailable
5. **OpenAI API Errors**: Returns 500 with generic error message

## Model Configuration

- **Model**: `openai/gpt-4o` (via Vercel AI Gateway)
- **Temperature**: 0.3 (low for consistent, focused outputs)
- **Structured Output**: Uses Zod schema for guaranteed JSON structure
- **Validation**: Automatic schema validation ensures data integrity

## Best Practices

1. **Always validate inputs** before sending to AI
2. **Cache market data** to reduce API calls (5-minute TTL)
3. **Monitor AI outputs** for quality and consistency
4. **Log technical data** for debugging and improvement
5. **Add disclaimers** to all trading signals
6. **Never promise returns** or use absolute language
7. **Enforce stop losses** in all scenarios

## Future Enhancements

Potential improvements:
- Add more technical indicators (MACD, Bollinger Bands)
- Support for more asset classes (stocks, crypto)
- Backtesting functionality
- Multi-timeframe analysis
- Position sizing calculator
- Trade journal integration
