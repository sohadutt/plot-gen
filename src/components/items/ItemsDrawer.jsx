import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ItemsList } from './ItemsList'

export function ItemsDrawer({ isOpen, onClose, onItemSelect, onAddGenerated }) {
  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />}

      <div
        className={cn(
          'fixed bottom-0 right-0 top-0 z-50 w-full border-l border-line bg-surface md:w-[380px]',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="text-base font-semibold text-ink">Add items</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <ItemsList onItemSelect={onItemSelect} onAddGenerated={onAddGenerated} />
          </div>
        </div>
      </div>
    </>
  )
}
