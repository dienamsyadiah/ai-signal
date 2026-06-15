import { TopNav } from "@/components/top-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SignalForm } from "@/components/signal-form"
import { HowItWorks } from "@/components/how-it-works"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ✅ Top Navigation */}
      <TopNav />

      <main className="container mx-auto px-4 py-10">
        {/* Header text */}
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            AI Trading Signal Generator
          </h1>

          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-3xl">
            Generate sinyal BUY / SELL / WAIT lengkap dengan Entry, Stop Loss, dan
            2 Target Profit berbasis analisis teknikal & AI.
            Disarankan uji di akun demo terlebih dahulu.
          </p>

          {/* Content cards */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2 items-stretch">
            {/* Generate Signal */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Generate Signal</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pilih symbol, timeframe, style, dan profil risiko.
                </p>
              </CardHeader>
              <CardContent>
                <SignalForm />
              </CardContent>
            </Card>

            {/* How it works */}
            <HowItWorks />
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            © 2025 AI Signal Generator — Trading berisiko. Gunakan dengan bijak.
          </p>
        </div>
      </main>
    </div>
  )
}
