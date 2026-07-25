import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Input } from '../ui/Input'
import { Checkbox } from '../ui/Checkbox'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { cn } from '../../lib/utils'
import { cmToDisplay, displayToCm, getUnitLabel, getDecimalPlaces } from '../../lib/constants'
import { Configuration, configDimUnit } from '@blueprint3d/core/configuration'

const GROUND_PLANE_COLORS = [
  { hex: '#8ba888', label: 'Grass' },
  { hex: '#c2b280', label: 'Sand' },
  { hex: '#6b5335', label: 'Dirt' },
  { hex: '#4a4a4a', label: 'Asphalt' },
  { hex: '#9c9c9c', label: 'Concrete' },
  { hex: '#a3c9e2', label: 'Water' },
  { hex: '#8b3a2a', label: 'Brick' },
  { hex: '#f0f0f0', label: 'Snow' }
]

export function ContextMenu({ selectedItem, onDelete, onResize, onResizeStart, onFixedChange, onColorChange }) {
  const isMobile = useIsMobile()
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [depth, setDepth] = useState(0)
  const [fixed, setFixed] = useState(false)
  const [color, setColor] = useState('#8ba888')
  const [currentUnit, setCurrentUnit] = useState('inch')

  const isGroundPlane = !!selectedItem?.metadata?.groundPlaneParams

  useEffect(() => {
    const unit = Configuration.getStringValue(configDimUnit)
    setCurrentUnit(unit)

    if (selectedItem) {
      const decimals = getDecimalPlaces(unit)
      setWidth(Number(cmToDisplay(selectedItem.getWidth(), unit).toFixed(decimals)))
      setHeight(Number(cmToDisplay(selectedItem.getHeight(), unit).toFixed(decimals)))
      setDepth(Number(cmToDisplay(selectedItem.getDepth(), unit).toFixed(decimals)))
      setFixed(selectedItem.fixed || false)
      setColor(selectedItem.metadata?.color || '#8ba888')
    }
  }, [selectedItem])

  if (!selectedItem) return null

  const handleResize = (field, value) => {
    const newWidth = field === 'width' ? value : width
    const newHeight = field === 'height' ? value : height
    const newDepth = field === 'depth' ? value : depth

    if (field === 'width') setWidth(value)
    if (field === 'height') setHeight(value)
    if (field === 'depth') setDepth(value)

    onResize(displayToCm(newHeight, currentUnit), displayToCm(newWidth, currentUnit), displayToCm(newDepth, currentUnit))
  }

  const handleFixedChange = (checked) => {
    setFixed(checked)
    onFixedChange(checked)
  }

  const handleColorChange = (hex) => {
    setColor(hex)
    onColorChange?.(hex)
  }

  const itemLabel = selectedItem.metadata?.itemName || 'Item'

  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface/95 backdrop-blur-sm shadow-panel animate-slide-in-right',
        isMobile ? 'p-4 max-w-[320px]' : 'p-3.5 max-w-[280px]'
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn('font-semibold text-ink truncate', isMobile ? 'text-base' : 'text-sm')}>{itemLabel}</span>
        <button
          onClick={onDelete}
          aria-label="Delete item"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger-soft',
            isMobile ? 'h-9 w-9' : 'h-7 w-7'
          )}
        >
          <Trash2 className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
        </button>
      </div>

      <div className={cn('mb-3', isMobile ? 'space-y-3' : 'space-y-2')}>
        <div className={cn('grid grid-cols-3 text-xs', isMobile ? 'gap-3' : 'gap-2')}>
          {[
            { key: 'width', label: 'Width', value: width },
            { key: 'depth', label: 'Depth', value: depth },
            { key: 'height', label: 'Height', value: height }
          ].map((field) => (
            <div key={field.key}>
              <label className={cn('mb-1 block text-ink-muted', isMobile && 'text-sm')}>{field.label}</label>
              <Input
                type="number"
                value={field.value}
                onFocus={onResizeStart}
                onChange={(e) => handleResize(field.key, Number(e.target.value))}
                step={currentUnit === 'm' ? '0.01' : '1'}
                className={cn('font-mono', isMobile ? 'h-10 text-sm' : 'h-8 px-2 text-xs')}
              />
            </div>
          ))}
        </div>
        <p className={cn('text-center text-ink-muted', isMobile ? 'text-xs' : 'text-[10px]')}>{getUnitLabel(currentUnit)}</p>
      </div>

      {isGroundPlane && (
        <div className={cn('mb-3', isMobile ? 'space-y-2' : 'space-y-1.5')}>
          <label className={cn('block text-ink-muted', isMobile ? 'text-sm' : 'text-xs')}>Color</label>
          <div className="grid grid-cols-8 gap-1.5">
            {GROUND_PLANE_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.label}
                onClick={() => handleColorChange(c.hex)}
                style={{ backgroundColor: c.hex }}
                className={cn(
                  'aspect-square rounded-md border-2 transition-transform hover:scale-110',
                  color.toLowerCase() === c.hex ? 'border-primary' : 'border-line'
                )}
              />
            ))}
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="h-8 w-full cursor-pointer rounded-md border border-line bg-transparent p-1"
            aria-label="Custom color"
          />
        </div>
      )}

      <label
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-md transition-colors',
          isMobile ? 'min-h-[44px] px-3 py-2' : 'px-2 py-1.5 hover:bg-paper'
        )}
      >
        <Checkbox checked={fixed} onCheckedChange={handleFixedChange} className={isMobile ? 'h-5 w-5' : undefined} />
        <span className={cn('select-none text-ink', isMobile ? 'text-sm' : 'text-xs')}>Lock in place</span>
      </label>
    </div>
  )
}
