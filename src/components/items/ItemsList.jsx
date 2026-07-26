import { useEffect, useState, useCallback } from 'react'
import { Search, Upload, PackageSearch, Milestone, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { fetchItems } from '../../api/functions'
import { ITEM_CATEGORIES } from '../../lib/constants'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { GridSkeleton, EmptyState } from '../ui/Feedback'
import { ItemCard } from './ItemCard'
import { UploadItemDialog } from './UploadItemDialog'
import { EditItemDialog } from './EditItemDialog'
import { cn } from '../../lib/utils'

export function ItemsList({ onItemSelect, onAddGenerated }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchItems({ category: category === 'all' ? undefined : category, search: search || undefined })
      setItems(data)
    } catch (error) {
      console.error('Failed to load items:', error)
      toast.error('Could not load the item catalog.')
    } finally {
      setLoading(false)
    }
  }, [category, search])

  useEffect(() => {
    const timeout = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(timeout)
  }, [load, search])

  const handleUploaded = (item) => {
    setCategory('custom')
    setSearch('')
    setItems((prev) => [item, ...prev])
  }

  const handleDeleted = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdated = (updated) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-line p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search furniture, doors, windows…"
            className="pl-9"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {ITEM_CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                category === c.value ? 'bg-primary text-primary-foreground' : 'bg-paper text-ink-muted hover:text-ink'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload your own model
        </Button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onAddGenerated?.('stairs')}
            className="flex flex-col items-center gap-1 rounded-md border border-line bg-paper px-2 py-2.5 text-xs font-medium text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            <TrendingUp className="h-4 w-4" />
            Stairs
          </button>
          <button
            onClick={() => onAddGenerated?.('ground-plane')}
            className="flex flex-col items-center gap-1 rounded-md border border-line bg-paper px-2 py-2.5 text-xs font-medium text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            <Milestone className="h-4 w-4" />
            Road / land
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <GridSkeleton count={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Nothing here yet"
            description={category === 'custom' ? 'Upload a .glb model to get started.' : 'Try a different search or category.'}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onSelect={onItemSelect} onDeleted={handleDeleted} onEdit={setEditingItem} />
            ))}
          </div>
        )}
      </div>

      <UploadItemDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={handleUploaded} />
      <EditItemDialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)} item={editingItem} onUpdated={handleUpdated} />
    </div>
  )
}
