export const MOBILE_BREAKPOINT = 767

/** Room types a saved floorplan can be tagged with. Mirrors the values the API stores. */
export const ROOM_TYPES = [
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'living-room', label: 'Living Room' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'office', label: 'Office' }
]

export const DEFAULT_ROOM_TYPE = 'bedroom'

/** Furniture / fixture categories shown in the item browser. */
export const ITEM_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'bed', label: 'Beds' },
  { value: 'drawer', label: 'Drawers' },
  { value: 'wardrobe', label: 'Wardrobes' },
  { value: 'light', label: 'Lighting' },
  { value: 'storage', label: 'Storage' },
  { value: 'table', label: 'Tables' },
  { value: 'chair', label: 'Chairs' },
  { value: 'sofa', label: 'Sofas' },
  { value: 'armchair', label: 'Armchairs' },
  { value: 'stool', label: 'Stools' },
  { value: 'door', label: 'Doors' },
  { value: 'window', label: 'Windows' },
  { value: 'custom', label: 'My Uploads' }
]

/**
 * Blueprint3D item "type" codes expected by the engine's item Factory.
 * 1 = free-standing floor item, 3 = in-wall item (windows), 7 = in-wall-floor item (doors).
 */
export const CATEGORY_ITEM_TYPE = {
  door: '7',
  window: '3'
}

export function getItemTypeForCategory(category) {
  return CATEGORY_ITEM_TYPE[category] || '1'
}

/** Whether items in this category cut a hole in the wall they're placed on by default
 * (an "opening") — true for doors/windows, false for everything else. This is only ever
 * a *default*; it can still be overridden per-item via the `boolean` field. */
export function getDefaultBooleanForCategory(category) {
  return category === 'door' || category === 'window'
}

/** Dimension-unit conversions, shared by the context menu + settings panel. */
export function cmToDisplay(cm, unit) {
  switch (unit) {
    case 'inch': return cm / 2.54
    case 'm': return cm / 100
    case 'mm': return cm * 10
    case 'cm':
    default: return cm
  }
}

export function displayToCm(value, unit) {
  switch (unit) {
    case 'inch': return value * 2.54
    case 'm': return value * 100
    case 'mm': return value / 10
    case 'cm':
    default: return value
  }
}

export function getUnitLabel(unit) {
  switch (unit) {
    case 'inch': return 'inches'
    case 'm': return 'meters'
    case 'mm': return 'millimeters'
    case 'cm':
    default: return 'centimeters'
  }
}

export function getDecimalPlaces(unit) {
  switch (unit) {
    case 'm': return 2
    case 'cm': return 1
    case 'inch':
    case 'mm':
    default: return 0
  }
}

export const DIMENSION_UNITS = [
  { value: 'inch', label: 'Inches', description: 'Imperial, e.g. 96"' },
  { value: 'cm', label: 'Centimeters', description: 'Metric, e.g. 240 cm' },
  { value: 'm', label: 'Meters', description: 'Metric, e.g. 2.4 m' },
  { value: 'mm', label: 'Millimeters', description: 'Metric, high precision' }
]
