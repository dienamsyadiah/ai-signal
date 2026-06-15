import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Shield, Sparkles } from "lucide-react"

export function HowItWorks() {
  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Cara Kerja</CardTitle>
        <p className="text-sm text-muted-foreground">Alur singkat pembuatan sinyal</p>
      </CardHeader>

      {/* h-full + flex agar konten “mengisi” card dan tidak terlihat kosong */}
      <CardContent className="h-full flex flex-col">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Ambil data pasar (OHLC)</p>
              <p className="text-sm text-muted-foreground">
                Sistem mengambil harga berdasarkan symbol & timeframe, lalu menghitung indikator (SMA, RSI, ATR).
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">AI menyusun bias & level</p>
              <p className="text-sm text-muted-foreground">
                AI menentukan BUY / SELL / WAIT dan menghitung Entry, Stop Loss (berbasis ATR), serta TP1 & TP2.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Uji di akun demo</p>
              <p className="text-sm text-muted-foreground">
                Gunakan TradingView Paper Trading atau broker demo untuk mengukur performa sebelum dipakai real.
              </p>
            </div>
          </div>
        </div>

        {/* “Spacer” yang rapi + disclaimer nempel bawah (tidak ada ruang kosong aneh) */}
        <div className="mt-auto pt-4">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Disclaimer:</span> Sinyal bersifat edukatif dan bukan nasihat keuangan.
              Risiko trading sepenuhnya tanggung jawab pengguna.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
