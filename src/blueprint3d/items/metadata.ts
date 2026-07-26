/** Meta data for items. */
export interface Metadata {
  /** Name of the item. */
  itemName?: string

  /** Translation key for the item name (i18n). */
  itemKey?: string

  /** Catalog category (e.g. 'door', 'window', 'table'). */
  category?: string

  /** Type of the item. */
  itemType?: number

  /** Url of the model. */
  modelUrl?: string

  /** Resizeable or not */
  resizable?: boolean

  /**
   * Whether this item performs a boolean subtraction (cuts a hole) in the wall
   * it's attached to — used for doors/windows so you can see/walk through the
   * opening. Only meaningful for wall-mounted items (addToWall = true); ignored
   * otherwise. Defaults to true when unset, since every current wall-mounted
   * item in the catalog is a door or window and expects a hole.
   */
  boolean?: boolean

  /** Description of the item for AI understanding */
  description?: string

  /**
   * A top-down icon for this item in the 2D floorplan view, authored in a
   * small SVG-path-like format so it doesn't need real image assets:
   *   { viewBox: { width, height }, paths: [{ d, fill?, stroke? }] }
   * `viewBox` is in cm, centered on the item's origin (matching how
   * getCorners() lays out the item's footprint) at the item's *default*
   * size — paths are scaled to the item's current (possibly resized)
   * width/depth at draw time. When absent, the 2D view falls back to
   * drawing a plain rectangle sized to the item's current footprint.
   */
  viewerData?: {
    viewBox: { width: number; height: number }
    paths: Array<{ d: string; fill?: string; stroke?: string }>
  }

  /** Params for a procedurally-generated StairsItem — see items/generators/stairs.ts. */
  stairsParams?: { width: number; totalRise: number; totalRun: number; stepCount?: number }

  /** Params for a procedurally-generated GroundPlaneItem — see items/generators/ground_plane.ts. */
  groundPlaneParams?: { width: number; depth: number; thickness?: number }

  /** Params for an invisible wall boolean cutter — see items/generators/boolean_cutter.ts. */
  booleanCutterParams?: { shape: 'cube' | 'cylinder'; width: number; height: number; depth: number }

  /** Solid color for a GroundPlaneItem (hex string, e.g. '#8ba888'). Falls back to a
   * neutral land-green when unset. */
  color?: string
}
