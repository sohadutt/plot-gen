import { useState } from 'react'
import { Trash2, Scissors, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { deleteItem } from '../../api/functions'
import { cn } from '../../lib/utils'

export function ItemCard({ item, onSelect, onDeleted, onEdit }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e) => {
    e.stopPropagation()
    setDeleting(true)
    try {
      await deleteItem(item.id)
      onDeleted(item.id)
    } catch (error) {
      console.error('Failed to delete item:', error)
      toast.error('Could not delete item.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={() => onSelect(item)}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-md border border-line bg-surface text-left transition-all',
        'hover:border-primary hover:shadow-sm active:scale-[0.98]'
      )}
    >
      <div className="aspect-square w-full overflow-hidden bg-paper">
        {item.image ? (
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-muted">No preview</div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-medium text-ink">{item.name}</p>
      </div>

      {item.boolean && (
        <span
          title="Cuts through the wall"
          className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-surface/90 text-ink-muted shadow-sm"
        >
          <Scissors className="h-3 w-3" />
        </span>
      )}

      {item.isCustom && (
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(item)
            }}
            aria-label="Edit item"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-surface/90 text-ink-muted shadow-sm hover:bg-paper hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete uploaded item"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-surface/90 text-danger shadow-sm hover:bg-danger-soft"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {item.isCustom && item.isPublic && (
        <span className="absolute bottom-1.5 left-1.5 rounded bg-surface/90 px-1.5 py-0.5 text-[9px] font-medium text-primary shadow-sm">
          Public
        </span>
      )}
    </button>
  )
}
