import { Suspense } from "react"
import { SignalResult } from "@/components/signal-result"
import { TopNav } from "@/components/top-nav"
import { Loader2 } from "lucide-react"

export default function SignalPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="container mx-auto px-4 py-8">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Generating AI signal...</p>
            </div>
          }
        >
          <SignalResult />
        </Suspense>
      </main>
    </div>
  )
}
