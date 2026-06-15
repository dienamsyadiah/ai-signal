import { TopNav } from "@/components/top-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Database,
  LineChart,
  Brain,
  ShieldCheck,
  AlertTriangle,
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react"

export default function MethodPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Metodologi & Transparansi</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Memahami bagaimana sistem AI Signal Generator bekerja, keterbatasannya, dan bagaimana kami mengukur
            performa.
          </p>
        </div>

        {/* System Flow Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Alur Sistem
          </h2>

          <div className="grid gap-4">
            {/* Step 1: Data */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Database className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">1. Pengambilan Data Market</CardTitle>
                    <CardDescription>Real-time OHLCV data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Data diambil dari provider (Twelve Data / Yahoo Finance)</li>
                  <li>Mengambil 100 candle terakhir untuk analisis</li>
                  <li>Mendukung timeframe: 1m, 5m, 15m, 1h, 4h, 1D</li>
                  <li>Data mencakup: Open, High, Low, Close, Volume</li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 2: Indicators */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <LineChart className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">2. Kalkulasi Indikator Teknikal</CardTitle>
                    <CardDescription>Technical analysis features</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-foreground mb-2">Trend & Momentum:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>SMA 20 & SMA 50 (trend detection)</li>
                      <li>RSI 14 (overbought/oversold)</li>
                      <li>Trend direction (UP/DOWN/SIDEWAYS)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-2">Volatilitas & Levels:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>ATR 14 (volatility measure)</li>
                      <li>Support & Resistance (swing H/L)</li>
                      <li>Last close price</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3: AI Analysis */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                    <Brain className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">3. Analisis AI (GPT-4o)</CardTitle>
                    <CardDescription>Structured signal generation</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-3">AI menerima ringkasan teknikal dan menghasilkan sinyal terstruktur:</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Bias</Badge>
                      <span>BUY / SELL / WAIT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Entry</Badge>
                      <span>Market / Limit / Stop</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Stop Loss</Badge>
                      <span>ATR-based (wajib)</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Take Profit</Badge>
                      <span>2 target (R:R min 1.5)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Confidence</Badge>
                      <span>0-100% (Low/Med/High)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Rationale</Badge>
                      <span>Alasan & catatan risiko</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 4: Validation */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">4. Validasi & Guardrails</CardTitle>
                    <CardDescription>Safety checks & disclaimers</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Schema validation dengan Zod (memastikan format output)</li>
                  <li>
                    Stop Loss <strong>wajib</strong> ada di setiap sinyal
                  </li>
                  <li>AI boleh memilih WAIT jika setup tidak jelas</li>
                  <li>Disclaimer otomatis ditambahkan ke setiap sinyal</li>
                  <li>Cache 10 menit untuk mencegah request berlebih</li>
                  <li>Rate limit 10 request/jam per IP</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator className="my-10" />

        {/* Limitations Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Batasan & Disclaimer
          </h2>

          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Bukan Nasihat Finansial</AlertTitle>
            <AlertDescription>
              Sinyal yang dihasilkan oleh sistem ini adalah untuk tujuan edukasi dan informasi saja. Kami TIDAK
              memberikan nasihat investasi atau finansial.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Yang TIDAK Kami Jamin
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">×</span>
                    <span>Profit atau keuntungan tertentu</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">×</span>
                    <span>Akurasi 100% dari prediksi</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">×</span>
                    <span>Kesesuaian untuk setiap kondisi pasar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">×</span>
                    <span>Penggantian analisis mandiri</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">×</span>
                    <span>Perlindungan dari kerugian</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-green-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Yang Kami Sediakan
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Analisis teknikal otomatis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Ide trading terstruktur dengan SL/TP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Transparansi level confidence</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Alasan (rationale) untuk setiap sinyal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Catatan risiko untuk pertimbangan</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4 bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Tanggung Jawab Pengguna</p>
                  <p>
                    Keputusan trading sepenuhnya tanggung jawab Anda. Selalu lakukan riset mandiri (DYOR), pertimbangkan
                    toleransi risiko Anda, dan jangan pernah trading dengan uang yang tidak mampu Anda kehilangan.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator className="my-10" />

        {/* Evaluation Metrics Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Metrik Evaluasi & Rencana Backtest
          </h2>

          <p className="text-muted-foreground mb-6">
            Untuk mengukur efektivitas sistem secara objektif, kami akan menggunakan metrik standar industri berikut:
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {/* Win Rate */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Win Rate</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Persentase trade yang mencapai TP vs total trade.</p>
                <div className="bg-muted rounded-md p-2 font-mono text-xs">
                  Win Rate = (Winning Trades / Total Trades) × 100%
                </div>
                <p className="mt-2 text-xs">
                  <span className="text-amber-500">Target:</span> &gt;50% untuk sistem viable
                </p>
              </CardContent>
            </Card>

            {/* Risk Reward Ratio */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-base">Risk:Reward Ratio</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Perbandingan potensi profit vs risiko per trade.</p>
                <div className="bg-muted rounded-md p-2 font-mono text-xs">R:R = (TP - Entry) / (Entry - SL)</div>
                <p className="mt-2 text-xs">
                  <span className="text-amber-500">Target:</span> Minimum 1.5:1 per sinyal
                </p>
              </CardContent>
            </Card>

            {/* Max Drawdown */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-base">Max Drawdown</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Penurunan maksimum dari puncak equity.</p>
                <div className="bg-muted rounded-md p-2 font-mono text-xs">MDD = (Peak - Trough) / Peak × 100%</div>
                <p className="mt-2 text-xs">
                  <span className="text-amber-500">Target:</span> &lt;20% untuk risk management
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Metrics */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Metrik Tambahan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-foreground">Expectancy (E)</p>
                    <p className="text-muted-foreground text-xs">E = (Win% × Avg Win) - (Loss% × Avg Loss)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Nilai positif = sistem profitable jangka panjang
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Profit Factor</p>
                    <p className="text-muted-foreground text-xs">PF = Gross Profit / Gross Loss</p>
                    <p className="text-xs text-muted-foreground mt-1">Target: &gt;1.5 untuk sistem yang sehat</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-foreground">Average Trade Duration</p>
                    <p className="text-muted-foreground text-xs">Rata-rata waktu holding per trade</p>
                    <p className="text-xs text-muted-foreground mt-1">Untuk evaluasi kesesuaian dengan timeframe</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Consecutive Losses</p>
                    <p className="text-muted-foreground text-xs">Jumlah maksimum losing streak</p>
                    <p className="text-xs text-muted-foreground mt-1">Penting untuk psychological risk assessment</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Backtest Plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Rencana Backtest</CardTitle>
              </div>
              <CardDescription>Framework untuk menguji performa sistem secara objektif</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-foreground mb-2">Phase 1: Paper Trading (1-2 minggu)</p>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Catat semua sinyal yang dihasilkan dengan timestamp</li>
                    <li>Track apakah entry terpicu dan hasil akhir (TP/SL hit)</li>
                    <li>Minimum 50 sinyal untuk validitas statistik</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-foreground mb-2">Phase 2: Historical Backtest</p>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Gunakan data historis 3-6 bulan terakhir</li>
                    <li>Simulasikan sinyal pada berbagai kondisi market</li>
                    <li>Test pada berbagai pair dan timeframe</li>
                    <li>Identifikasi kondisi optimal dan suboptimal</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-foreground mb-2">Phase 3: Forward Testing</p>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Live demo account dengan modal virtual</li>
                    <li>Eksekusi sinyal secara real-time selama 1 bulan</li>
                    <li>Dokumentasi slippage dan execution quality</li>
                    <li>Evaluasi performa vs backtest results</li>
                  </ul>
                </div>

                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Coming Soon</AlertTitle>
                  <AlertDescription>
                    Fitur tracking hasil dan dashboard statistik akan ditambahkan di versi mendatang untuk memudahkan
                    evaluasi performa sistem.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer CTA */}
        <div className="text-center py-6">
          <p className="text-muted-foreground mb-4">Ada pertanyaan tentang metodologi kami?</p>
          <Badge variant="outline" className="text-sm">
            Transparansi adalah prioritas kami
          </Badge>
        </div>
      </main>
    </div>
  )
}
