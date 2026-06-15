import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"

import { Toaster } from "@/components/ui/toaster"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AI Signal Generator",
  description: "AI-based trading signal generator",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
