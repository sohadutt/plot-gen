import { useEffect, useState, useCallback } from 'react'
import { Plus, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { fetchTextures } from '../../api/functions'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { cn } from '../../lib/utils'
import { Spinner } from '../ui/Feedback'
import { UploadTextureDialog } from './UploadTextureDialog'
import { AddColorDialog } from './AddColorDialog'

export function TextureSelector({ type, onTextureSelect }) {
  const isMobile = useIsMobile()
  const [textures, setTextures] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)

  const load = useCallback(async () => {
    if (!type) return
    setLoading(true)
    try {
      const data = await fetchTextures(type)
      setTextures(data)
    } catch (error) {
      console.error('Failed to load textures:', error)
      toast.error('Could not load textures.')
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  if (!type) return null

  const selectTexture = (texture) => {
    onTextureSelect(texture.url, texture.stretch, texture.scale, {
      isColor: texture.isColor,
      color: texture.color,
      glossy: texture.glossy
    })
  }

  const handleUploaded = (texture) => {
    setTextures((prev) => [texture, ...prev])
    selectTexture(texture)
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface/95 backdrop-blur-sm shadow-panel animate-slide-in-right',
        isMobile ? 'p-4 max-w-[280px]' : 'p-3.5 max-w-[240px]'
      )}
    >
      <h3 className={cn('font-semibold text-ink', isMobile ? 'mb-3 text-base' : 'mb-2 text-sm')}>
        {type === 'floor' ? 'Floor texture' : 'Wall texture'}
      </h3>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (
        <div className={cn('grid grid-cols-2', isMobile ? 'gap-3' : 'gap-2')}>
          {textures.map((texture) => (
            <button
              key={texture.id}
              onClick={() => selectTexture(texture)}
              title={texture.name}
              style={texture.isColor ? { backgroundColor: texture.color } : undefined}
              className={cn(
                'relative aspect-square overflow-hidden rounded-md border-2 border-line transition-all hover:border-primary active:scale-95',
                isMobile ? 'min-h-[60px]' : 'hover:scale-105'
              )}
            >
              {!texture.isColor && (
                <img src={texture.thumbnail || texture.url} alt={texture.name} className="h-full w-full object-cover" />
              )}
            </button>
          ))}

          <button
            onClick={() => setUploadOpen(true)}
            title="Upload texture"
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-ink-muted transition-colors hover:border-primary hover:text-primary',
              isMobile ? 'min-h-[60px]' : ''
            )}
          >
            <Plus className="h-4 w-4" />
            <span className="text-[10px]">Upload</span>
          </button>

          <button
            onClick={() => setColorOpen(true)}
            title="Add solid color"
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-ink-muted transition-colors hover:border-primary hover:text-primary',
              isMobile ? 'min-h-[60px]' : ''
            )}
          >
            <Palette className="h-4 w-4" />
            <span className="text-[10px]">Color</span>
          </button>
        </div>
      )}

      <UploadTextureDialog open={uploadOpen} onOpenChange={setUploadOpen} type={type} onUploaded={handleUploaded} />
      <AddColorDialog open={colorOpen} onOpenChange={setColorOpen} type={type} onUploaded={handleUploaded} />
    </div>
  )
}
