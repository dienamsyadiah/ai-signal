"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, Search, Trash2, History, TrendingUp } from "lucide-react"
import Link from "next/link"
import { getHistory, deleteFromHistory, clearHistory, type SignalHistoryItem } from "@/lib/history"
import { HistoryCard } from "@/components/history-card"
import { HistoryDetailModal } from "@/components/history-detail-modal"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

function HistorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-5 w-48" />
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-5 w-14" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <History className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Belum Ada Signal Tersimpan</h3>
        <p className="mb-6 text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
          Signal yang Anda simpan akan muncul di sini. Generate signal pertama Anda untuk memulai.
        </p>
        <Link href="/">
          <Button>
            <TrendingUp className="h-4 w-4 mr-2" />
            Generate Signal Pertama
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Tidak Ada Hasil</h3>
        <p className="mb-4 text-muted-foreground text-sm">Tidak ada signal yang cocok dengan filter Anda</p>
        <Button variant="outline" size="sm" onClick={onClear}>
          Hapus Filter
        </Button>
      </CardContent>
    </Card>
  )
}

export function SignalHistory() {
  const { toast } = useToast()
  const [history, setHistory] = useState<SignalHistoryItem[]>([])
  const [filteredHistory, setFilteredHistory] = useState<SignalHistoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<SignalHistoryItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [biasFilter, setBiasFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate async load for skeleton demo
    const timer = setTimeout(() => {
      const loadedHistory = getHistory()
      setHistory(loadedHistory)
      setFilteredHistory(loadedHistory)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let filtered = history

    if (searchQuery) {
      filtered = filtered.filter((item) => item.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    if (biasFilter !== "all") {
      filtered = filtered.filter((item) => item.signal.bias === biasFilter)
    }

    setFilteredHistory(filtered)
  }, [searchQuery, biasFilter, history])

  const handleView = (item: SignalHistoryItem) => {
    setSelectedItem(item)
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    deleteFromHistory(id)
    setHistory((prev) => prev.filter((item) => item.id !== id))
    toast({
      title: "Signal Dihapus",
      description: "Signal berhasil dihapus dari history",
    })
  }

  const handleClearAll = () => {
    clearHistory()
    setHistory([])
    setFilteredHistory([])
    toast({
      title: "History Dihapus",
      description: "Semua signal berhasil dihapus",
    })
  }

  const handleClearFilters = () => {
    setSearchQuery("")
    setBiasFilter("all")
  }

  if (loading) {
    return <HistorySkeleton />
  }

  if (history.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters - Improved mobile layout */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2 sm:gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={biasFilter} onValueChange={setBiasFilter}>
            <SelectTrigger className="w-24 sm:w-32">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="BUY">BUY</SelectItem>
              <SelectItem value="SELL">SELL</SelectItem>
              <SelectItem value="WAIT">WAIT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Hapus Semua</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Hapus Semua History?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini tidak dapat dibatalkan. Semua {history.length} signal yang tersimpan akan dihapus permanen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAll} className="bg-red-600 hover:bg-red-700">
                Ya, Hapus Semua
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Menampilkan {filteredHistory.length} dari {history.length} signal
      </p>

      {/* History cards - Show no results state */}
      {filteredHistory.length === 0 ? (
        <NoResultsState onClear={handleClearFilters} />
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {filteredHistory.map((item) => (
            <HistoryCard key={item.id} item={item} onView={handleView} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      <HistoryDetailModal item={selectedItem} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  )
}
