import * as THREE from 'three'
import { Floorplan } from './floorplan'
import { Scene } from './scene'
import { EventEmitter } from '../core/events'
import type { SavedFloorplan } from './floorplan'
import { Factory, STAIRS_ITEM_TYPE, GROUND_PLANE_ITEM_TYPE } from '../items/factory'
import { createDefaultStairsMaterial } from '../items/generators/stairs'
import { createDefaultGroundPlaneMaterial } from '../items/generators/ground_plane'
import { createBooleanCutterMaterial } from '../items/generators/boolean_cutter'

export interface SerializedItem {
  item_name: string
  /** Catalog key/slug (e.g. 'door-single-01'), so a reloaded item can be traced back to its catalog entry. */
  item_key?: string
  /** Catalog category (e.g. 'door', 'window', 'table'). */
  category?: string
  item_type: number
  model_url: string
  xpos: number
  ypos: number
  zpos: number
  rotation: number
  scale_x: number
  scale_y: number
  scale_z: number
  fixed: boolean
  resizable?: boolean
  /** Whether this item cuts a hole in its wall (doors/windows). See items/metadata.ts. */
  boolean?: boolean
  description?: string // Description for AI understanding
  /** 2D top-down icon data — see Metadata.viewerData in items/metadata.ts. */
  viewer_data?: {
    viewBox: { width: number; height: number }
    paths: Array<{ d: string; fill?: string; stroke?: string }>
  }
  /** Params for a procedurally-generated StairsItem (item_type 11). */
  stairs_params?: { width: number; totalRise: number; totalRun: number; stepCount?: number }
  /** Params for a procedurally-generated GroundPlaneItem (item_type 12). */
  ground_plane_params?: { width: number; depth: number; thickness?: number }
  /** Params for a procedurally-generated boolean wall cutter (item_type 13/14). */
  boolean_cutter_params?: { shape: 'cube' | 'cylinder'; width: number; height: number; depth: number }
  /** Solid color for a GroundPlaneItem. */
  color?: string
}

/**
 * A Model connects a Floorplan and a Scene.
 */
export class Model {
  /** */
  public floorplan: Floorplan

  /** */
  public scene: Scene

  /** */
  private roomLoadingCallbacks = new EventEmitter<void>()

  /** */
  private roomLoadedCallbacks = new EventEmitter<void>()

  /** name */
  // @ts-ignore - roomSavedCallbacks is declared but not used, keeping for future use
  private roomSavedCallbacks = new EventEmitter<void>()

  /** success (bool), copy (bool) */
  // @ts-ignore - roomDeletedCallbacks is declared but not used, keeping for future use
  private roomDeletedCallbacks = new EventEmitter<{ success: boolean; copy: boolean }>()

  /** Fires whenever the undo/redo stacks change, so UI can enable/disable Undo/Redo controls. */
  public undoStateChangedCallbacks = new EventEmitter<void>()

  private undoStack: string[] = []
  private redoStack: string[] = []
  private readonly maxUndoStackSize = 50
  private isRestoringState = false

  /** Constructs a new model.
   * @param textureDir The directory containing the textures.
   */
  constructor(textureDir: string) {
    this.floorplan = new Floorplan()
    this.scene = new Scene(this, textureDir)
  }

  public loadSerialized(json: string): void {
    // TODO: better documentation on serialization format.
    // TODO: a much better serialization format.
    this.roomLoadingCallbacks.fire()

    const data = JSON.parse(json) as { floorplan: SavedFloorplan; items: SerializedItem[] }
    this.newRoom(data.floorplan, data.items)

    // A genuine load (New floorplan, opening a saved project) starts a fresh undo
    // history — undoing across two unrelated floorplans wouldn't make sense. Undo/redo's
    // own internal reload (isRestoringState) is the one exception, since it's what's
    // manipulating these stacks in the first place.
    if (!this.isRestoringState) {
      this.clearUndoHistory()
    }

    this.roomLoadedCallbacks.fire()
  }

  public exportSerialized(): string {
    const items_arr: SerializedItem[] = []
    const objects = this.scene.getItems()
    for (let i = 0; i < objects.length; i++) {
      const object = objects[i]
      const metadata = object.metadata
      items_arr[i] = {
        item_name: metadata.itemName ?? '',
        item_key: metadata.itemKey,
        category: metadata.category,
        item_type: metadata.itemType ?? 0,
        model_url: metadata.modelUrl ?? '',
        xpos: object.position.x,
        ypos: object.position.y,
        zpos: object.position.z,
        rotation: object.rotation.y,
        scale_x: object.scale.x,
        scale_y: object.scale.y,
        scale_z: object.scale.z,
        fixed: object.fixed,
        resizable: metadata.resizable,
        boolean: metadata.boolean,
        description: metadata.description,
        viewer_data: metadata.viewerData,
        stairs_params: metadata.stairsParams,
        ground_plane_params: metadata.groundPlaneParams,
        boolean_cutter_params: metadata.booleanCutterParams,
        color: metadata.color
      }
    }

    const room = {
      floorplan: this.floorplan.saveFloorplan(),
      items: items_arr
    }

    return JSON.stringify(room)
  }

  private newRoom(floorplan: SavedFloorplan, items: SerializedItem[]): void {
    this.scene.clearItems()
    this.floorplan.loadFloorplan(floorplan)
    items.forEach((item) => {
      const position = new THREE.Vector3(item.xpos, item.ypos, item.zpos)
      const metadata = {
        itemName: item.item_name,
        itemKey: item.item_key,
        category: item.category,
        resizable: item.resizable,
        itemType: item.item_type,
        modelUrl: item.model_url,
        boolean: item.boolean,
        description: item.description,
        viewerData: item.viewer_data,
        stairsParams: item.stairs_params,
        groundPlaneParams: item.ground_plane_params,
        booleanCutterParams: item.boolean_cutter_params,
        color: item.color
      }
      const scale = new THREE.Vector3(item.scale_x, item.scale_y, item.scale_z)

      if (Factory.isGenerated(item.item_type)) {
        // No model file to load — these build their own geometry from
        // metadata params (see Scene.addGeneratedItem). scale is always
        // (1,1,1) for these, so it's intentionally not passed through here.
        const material =
          item.item_type === STAIRS_ITEM_TYPE
            ? createDefaultStairsMaterial()
            : item.item_type === GROUND_PLANE_ITEM_TYPE
              ? createDefaultGroundPlaneMaterial()
              : createBooleanCutterMaterial()
        this.scene.addGeneratedItem(item.item_type, metadata, material, position, item.rotation)
        return
      }

      this.scene.addItem(
        item.item_type,
        item.model_url,
        metadata,
        position,
        item.rotation,
        scale,
        item.fixed
      )
    })
  }

  /**
   * Snapshots the current state onto the undo stack. Call this right BEFORE a change
   * starts (a drag's mousedown, a delete, placing a new wall point, a texture change,
   * a rename/resize) so undo restores to exactly how things were beforehand. A whole
   * drag gesture should get exactly one checkpoint (at its start), not one per frame.
   */
  public checkpoint(): void {
    if (this.isRestoringState) return

    const snapshot = this.exportSerialized()
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshot) {
      return // nothing's actually changed since the last checkpoint — don't waste a slot
    }

    this.undoStack.push(snapshot)
    if (this.undoStack.length > this.maxUndoStackSize) {
      this.undoStack.shift()
    }
    this.redoStack = []
    this.undoStateChangedCallbacks.fire()
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0
  }

  public undo(): void {
    if (this.undoStack.length === 0) return

    const current = this.exportSerialized()
    const previous = this.undoStack.pop() as string
    this.redoStack.push(current)

    this.isRestoringState = true
    this.loadSerialized(previous)
    this.isRestoringState = false

    this.undoStateChangedCallbacks.fire()
  }

  public redo(): void {
    if (this.redoStack.length === 0) return

    const current = this.exportSerialized()
    const next = this.redoStack.pop() as string
    this.undoStack.push(current)

    this.isRestoringState = true
    this.loadSerialized(next)
    this.isRestoringState = false

    this.undoStateChangedCallbacks.fire()
  }

  /** Clears undo/redo history. Called automatically by a genuine loadSerialized(); expose
   * it publicly too in case a caller wants to reset history without a full reload. */
  public clearUndoHistory(): void {
    this.undoStack = []
    this.redoStack = []
    this.undoStateChangedCallbacks.fire()
  }
}
