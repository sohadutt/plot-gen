import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/Dialog'
import { OptionList } from '../ui/OptionList'
import { Configuration, configDimUnit } from '@blueprint3d/core/configuration'
import { DIMENSION_UNITS } from '../../lib/constants'

export function SettingsDialog({ open, onOpenChange, onUnitChange }) {
  const [unit, setUnit] = useState(() => Configuration.getStringValue(configDimUnit) || 'inch')

  const handleChange = (value) => {
    setUnit(value)
    Configuration.setValue(configDimUnit, value)
    localStorage.setItem('dimensionUnit', value)
    onUnitChange?.(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Choose how measurements are displayed.</DialogDescription>
        </DialogHeader>

        <div>
          <label className="mb-2 block text-xs font-medium text-ink-muted">Dimension unit</label>
          <OptionList options={DIMENSION_UNITS} value={unit} onChange={handleChange} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
