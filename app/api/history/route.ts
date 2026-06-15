import { type NextRequest, NextResponse } from "next/server"

// Note: This API acts as a pass-through for client-side localStorage operations
// In a production app, this would connect to a real database

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const requiredFields = ["id", "symbol", "timeframe", "style", "riskProfile", "features", "signal"]
    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Validate features object
    if (!body.features || typeof body.features !== "object") {
      return NextResponse.json({ error: "Invalid features object" }, { status: 400 })
    }

    // Validate signal object
    if (!body.signal || typeof body.signal !== "object") {
      return NextResponse.json({ error: "Invalid signal object" }, { status: 400 })
    }

    const requiredSignalFields = ["bias", "confidence", "entryPrice", "stopLoss", "tp1", "tp2"]
    for (const field of requiredSignalFields) {
      if (!(field in body.signal)) {
        return NextResponse.json({ error: `Missing required signal field: ${field}` }, { status: 400 })
      }
    }

    // Validate bias value
    if (!["BUY", "SELL", "WAIT"].includes(body.signal.bias)) {
      return NextResponse.json({ error: "Invalid signal bias. Must be BUY, SELL, or WAIT" }, { status: 400 })
    }

    // Create standardized history item
    const historyItem = {
      id: body.id,
      createdAt: body.createdAt || new Date().toISOString(),
      symbol: body.symbol,
      timeframe: body.timeframe,
      style: body.style,
      riskProfile: body.riskProfile,
      features: {
        trend: body.features.trend || "unknown",
        rsi: Number(body.features.rsi) || 0,
        atr: Number(body.features.atr) || 0,
        support: Number(body.features.support) || 0,
        resistance: Number(body.features.resistance) || 0,
        lastClose: body.features.lastClose ? Number(body.features.lastClose) : undefined,
      },
      signal: {
        bias: body.signal.bias,
        confidence: Number(body.signal.confidence) || 0,
        entryPrice: Number(body.signal.entryPrice) || 0,
        entryType: body.signal.entryType || "Market",
        stopLoss: Number(body.signal.stopLoss) || 0,
        tp1: Number(body.signal.tp1) || 0,
        tp2: Number(body.signal.tp2) || 0,
        rationale: Array.isArray(body.signal.rationale) ? body.signal.rationale : [],
        riskNotes: Array.isArray(body.signal.riskNotes) ? body.signal.riskNotes : [],
      },
    }

    return NextResponse.json({
      success: true,
      item: historyItem,
      message: "Signal validated. Save to localStorage on client.",
    })
  } catch (error) {
    console.error("[v0] Error in history API:", error)
    return NextResponse.json({ error: "Failed to process history item" }, { status: 500 })
  }
}

export async function GET() {
  // Since we're using localStorage, this endpoint just returns a message
  return NextResponse.json({
    message: "History is stored in localStorage. Use client-side getHistory() function.",
  })
}
