import { SignalHistory } from "@/components/signal-history"
import { TopNav } from "@/components/top-nav"

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Signal History</h1>
          <p className="text-muted-foreground">View all your previously generated trading signals</p>
        </div>

        <SignalHistory />
      </main>
    </div>
  )
}
