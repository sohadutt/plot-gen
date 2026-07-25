import { Model } from './model/model'
import { Floorplanner } from './floorplanner/floorplanner'
import { Main } from './three/main'

/** Startup options. */
export interface Options {
  /** */
  widget?: boolean

  /** */
  threeElement?: string

  /** */
  floorplannerElement?: string

  /** The texture directory. */
  textureDir?: string

  /** Enable/disable wheel zoom (default: true). Set to false for logged-out users to allow page scroll. */
  enableWheelZoom?: boolean

  /** Enable continuous rotation even after user interaction (default: false). */
  alwaysSpin?: boolean
}

/** Blueprint3D core application. */
export class Blueprint3d {
  public model: Model

  public three: Main

  public floorplanner?: Floorplanner

  /** Creates an instance.
   * @param options The initialization options.
   */
  constructor(options: Options) {
    this.model = new Model(options.textureDir || '')
    this.three = new Main(this.model, options.threeElement || document.body, undefined, {
      enableWheelZoom: options.enableWheelZoom ?? true,
      alwaysSpin: options.alwaysSpin ?? false
    })

    if (!options.widget) {
      this.floorplanner = new Floorplanner(options.floorplannerElement || '', this.model)
    } else {
      this.three.getController().enabled = false
    }
  }

  /**
   * Stops the render loop and removes every window/document-level listener the engine
   * registered (3D's render loop + resize/focus-key listeners, 2D's resize/typing
   * listeners). Call this in the cleanup function of whatever effect constructed the
   * Blueprint3d instance — without it, the render loop keeps rendering a detached scene
   * forever and stale listeners keep firing (e.g. a "canvas not found" warning) against
   * elements that no longer exist once the owning component unmounts.
   */
  public destroy(): void {
    this.three.destroy()
    this.floorplanner?.destroy()
  }
}
