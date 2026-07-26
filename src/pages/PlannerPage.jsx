import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Blueprint3d } from '@blueprint3d/blueprint3d'
import { floorplannerModes } from '@blueprint3d/floorplanner/floorplanner_view'
import { Configuration, configDimUnit } from '@blueprint3d/core/configuration'
import DefaultFloorplan from '@blueprint3d/templates/default.json'

import { fetchTemplateByRoomType, fetchFloorplanById, createFloorplan, updateFloorplan, uploadDataUrl } from '../api/functions'
import { createDefaultStairsMaterial } from '@blueprint3d/items/generators/stairs'
import { createDefaultGroundPlaneMaterial } from '@blueprint3d/items/generators/ground_plane'
import { createBooleanCutterMaterial } from '@blueprint3d/items/generators/boolean_cutter'
import { STAIRS_ITEM_TYPE, GROUND_PLANE_ITEM_TYPE, BOOLEAN_CUBE_ITEM_TYPE, BOOLEAN_CYLINDER_ITEM_TYPE } from '@blueprint3d/items/factory'
import { ENDPOINTS } from '../api/urls'
import { DEFAULT_ROOM_TYPE } from '../lib/constants'
import { captureTopDownSnapshot } from '../lib/topDownSnapshot'
import { useIsMobile } from '../hooks/useMediaQuery'
import { cn } from '../lib/utils'

import { TopNavBar } from '../components/layout/TopNavBar'
import { FloorplannerControls } from '../components/floorplanner/FloorplannerControls'
import { ControlsHelp } from '../components/floorplanner/ControlsHelp'
import { ZoomIndicator } from '../components/floorplanner/ZoomIndicator'
import { DrawingLengthTooltip } from '../components/floorplanner/DrawingLengthTooltip'
import { CutLengthTooltip } from '../components/floorplanner/CutLengthTooltip'
import { MeasureTooltip } from '../components/floorplanner/MeasureTooltip'
import { ItemsDrawer } from '../components/items/ItemsDrawer'
import { TextureSelector } from '../components/textures/TextureSelector'
import { RenderCarousel } from '../components/renders/RenderCarousel'
import { ContextMenu } from '../components/context-menu/ContextMenu'
import { ProjectsView } from '../components/projects/ProjectsView'
import { RoomsPanel } from '../components/rooms/RoomsPanel'
import { RoomLabels3D } from '../components/floorplanner/RoomLabels3D'
import { ExportDialog } from '../components/dialogs/ExportDialog'
import { SettingsDialog } from '../components/dialogs/SettingsDialog'
import { NewFloorplanDialog } from '../components/dialogs/NewFloorplanDialog'
import { SaveFloorplanDialog } from '../components/dialogs/SaveFloorplanDialog'

export default function PlannerPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const contentRef = useRef(null)
  const viewerRef = useRef(null)
  const floorplannerCanvasRef = useRef(null)
  const blueprint3dRef = useRef(null)
  const loadingToastsRef = useRef([])

  const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'design')
  const [viewMode, setViewMode] = useState('3d')
  const [floorplannerMode, setFloorplannerMode] = useState('move')

  const [selectedItem, setSelectedItem] = useState(null)
  const [textureType, setTextureType] = useState(null)
  const [currentTarget, setCurrentTarget] = useState(null)
  const [itemsLoading, setItemsLoading] = useState(0)
  const [drawingLength, setDrawingLength] = useState(null)
  const [cutLength, setCutLength] = useState(null)
  const [measureLength, setMeasureLength] = useState(null)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [currentBlueprint, setCurrentBlueprint] = useState(null)

  const [roomsPanelOpen, setRoomsPanelOpen] = useState(false)
  const [hoveredRoomUuid, setHoveredRoomUuid] = useState(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [engineReady, setEngineReady] = useState(false)
  const [zoomPercent, setZoomPercent] = useState(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  /* ---------------------------------------------------------------- *
   * Engine bootstrap
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (!viewerRef.current || blueprint3dRef.current) return

    const savedUnit = localStorage.getItem('dimensionUnit')
    if (savedUnit) Configuration.setValue(configDimUnit, savedUnit)

    const blueprint3d = new Blueprint3d({
      floorplannerElement: 'floorplanner-canvas',
      threeElement: '#viewer',
      textureDir: '/models/textures/',
      widget: false,
      enableWheelZoom: true
    })
    blueprint3dRef.current = blueprint3d

    blueprint3d.three.itemSelectedCallbacks.add((item) => {
      setSelectedItem(item)
      setTextureType(null)
    })
    blueprint3d.three.itemUnselectedCallbacks.add(() => setSelectedItem(null))
    blueprint3d.three.wallClicked.add((halfEdge) => {
      setCurrentTarget(halfEdge)
      setTextureType('wall')
      setSelectedItem(null)
    })
    blueprint3d.three.floorClicked.add((room) => {
      setCurrentTarget(room)
      setTextureType('floor')
      setSelectedItem(null)
      // Clicking a room, not just pressing F while hovering it, also frames it — see PlannerPage docs.
      blueprint3d.three.focusOnRoom(room)
    })
    blueprint3d.three.nothingClicked.add(() => {
      setTextureType(null)
      setCurrentTarget(null)
    })

    blueprint3d.three.getController().roomHoverCallbacks.add((room) => {
      setHoveredRoomUuid(room ? room.getUuid() : null)
    })

    blueprint3d.floorplanner?.zoomChangedCallbacks.add((percent) => setZoomPercent(percent))

    blueprint3d.model.undoStateChangedCallbacks.add(() => {
      setCanUndo(blueprint3d.model.canUndo())
      setCanRedo(blueprint3d.model.canRedo())
    })

    blueprint3d.floorplanner?.drawingLengthCallbacks.add((info) => setDrawingLength(info))
    blueprint3d.floorplanner?.cutLengthCallbacks.add((info) => setCutLength(info))
    blueprint3d.floorplanner?.measureLengthCallbacks.add((info) => setMeasureLength(info))
    blueprint3d.floorplanner?.cutBlockedCallbacks.add(() => {
      toast.error("Can't cut here", { description: 'Move the door or window off this wall first, then try cutting it again.' })
    })

    blueprint3d.model.scene.itemLoadingCallbacks.add(() => setItemsLoading((prev) => prev + 1))
    blueprint3d.model.scene.itemLoadedCallbacks.add((item) => {
      setItemsLoading((prev) => prev - 1)
      const pending = loadingToastsRef.current
      if (pending.length > 0) {
        const { toastId, itemName, autoSelect } = pending.shift()
        toast.success(`${itemName} added`, { id: toastId })
        if (autoSelect) {
          // Doors/windows: select immediately so the size panel is right there —
          // no need to hunt for it in the 3D view before you can type an exact width.
          blueprint3d.three.getController().setSelectedObject(item)
        }
      }
    })
    blueprint3d.model.scene.itemLoadErrorCallbacks.add(() => {
      setItemsLoading((prev) => prev - 1)
      const pending = loadingToastsRef.current
      if (pending.length > 0) {
        const { toastId, itemName } = pending.shift()
        toast.error(`Couldn't load ${itemName}`, { id: toastId })
      }
    })

    ;(async () => {
      const openId = location.state?.openFloorplanId
      const newRoomType = location.state?.newRoomType

      try {
        if (openId) {
          const full = await fetchFloorplanById(openId)
          blueprint3d.model.loadSerialized(JSON.stringify(full.layoutData))
          setCurrentBlueprint({ id: full.id, name: full.name, roomType: full.roomType || DEFAULT_ROOM_TYPE })
        } else {
          const template = await fetchTemplateByRoomType(newRoomType || DEFAULT_ROOM_TYPE)
          blueprint3d.model.loadSerialized(JSON.stringify(template.layoutData))
        }
      } catch (error) {
        console.error('Falling back to bundled template:', error)
        blueprint3d.model.loadSerialized(JSON.stringify(DefaultFloorplan))
      } finally {
        // Clear the one-shot navigation hint so coming back here later (e.g. browser
        // back) doesn't repeat "open this floorplan" / "start this room type" again.
        if (openId || newRoomType) navigate(location.pathname, { replace: true, state: null })
        setEngineReady(true)
      }
    })()

    // Stops the 3D render loop and removes every window/document listener the engine
    // registered — without this, navigating away from the planner (Dashboard, logging
    // out, StrictMode's dev-mode double-invoke) leaves the render loop running against a
    // detached canvas forever, and stale resize/keydown listeners keep firing against
    // elements that no longer exist (that's what a "canvas not found" warning after
    // leaving this page means).
    return () => {
      blueprint3d.destroy()
      blueprint3dRef.current = null
    }
  }, [])

  /* ---------------------------------------------------------------- *
   * Resize handling
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const handleResize = () => {
      if (!blueprint3dRef.current || activeTab !== 'design') return
      if (viewMode === '3d') blueprint3dRef.current.three.updateWindowSize()
      else blueprint3dRef.current.floorplanner?.resizeView()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeTab, viewMode])

  useEffect(() => {
    if (!contentRef.current || !blueprint3dRef.current) return
    const observer = new ResizeObserver(() => {
      if (!blueprint3dRef.current || activeTab !== 'design') return
      if (viewMode === '3d') blueprint3dRef.current.three.updateWindowSize()
      else blueprint3dRef.current.floorplanner?.resizeView()
    })
    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [activeTab, viewMode])

  /* ---------------------------------------------------------------- *
   * View + mode handlers
   * ---------------------------------------------------------------- */
  const handleViewChange = useCallback((mode) => {
    if (!blueprint3dRef.current) return
    blueprint3dRef.current.three.setViewMode(mode)
    setViewMode(mode)

    setTimeout(() => {
      if (!blueprint3dRef.current) return
      if (mode === '2d') {
        blueprint3dRef.current.floorplanner?.reset()
      } else {
        blueprint3dRef.current.model.floorplan.update()
        blueprint3dRef.current.three.updateWindowSize()
      }
    }, 50)
  }, [])

  const handleFloorplannerModeChange = useCallback((mode) => {
    setFloorplannerMode(mode)
    if (!blueprint3dRef.current) return
    const modeMap = {
      move: floorplannerModes.MOVE,
      draw: floorplannerModes.DRAW,
      cut: floorplannerModes.CUT,
      measure: floorplannerModes.MEASURE,
      delete: floorplannerModes.DELETE
    }
    blueprint3dRef.current.floorplanner?.setMode(modeMap[mode])
  }, [])

  const handleFloorplannerDone = useCallback(() => {
    setViewMode('3d')
    blueprint3dRef.current?.model.floorplan.update()
  }, [])

  const handleTabChange = useCallback(
    (tab) => {
      setActiveTab(tab)
      setTextureType(null)

      if (!blueprint3dRef.current || tab !== 'design') return
      blueprint3dRef.current.three.stopSpin()
      blueprint3dRef.current.three.getController().setSelectedObject(null)

      if (viewMode === '2d') {
        const canvas = floorplannerCanvasRef.current
        if (canvas) {
          const observer = new ResizeObserver(() => {
            if (blueprint3dRef.current && canvas.clientWidth > 0) {
              blueprint3dRef.current.floorplanner?.reset()
              observer.disconnect()
            }
          })
          observer.observe(canvas)
        }
      } else {
        blueprint3dRef.current.model.floorplan.update()
        setTimeout(() => blueprint3dRef.current?.three.updateWindowSize(), 100)
      }
    },
    [viewMode]
  )

  /* ---------------------------------------------------------------- *
   * Selected item handlers
   * ---------------------------------------------------------------- */
  const handleDeleteItem = useCallback(() => {
    blueprint3dRef.current?.model.checkpoint()
    selectedItem?.removeFromScene()
    setSelectedItem(null)
  }, [selectedItem])

  const handleResizeStart = useCallback(() => {
    blueprint3dRef.current?.model.checkpoint()
  }, [])

  const handleResizeItem = useCallback(
    (height, width, depth) => selectedItem?.resize(height, width, depth),
    [selectedItem]
  )

  const handleFixedChange = useCallback(
    (fixed) => {
      blueprint3dRef.current?.model.checkpoint()
      selectedItem?.setFixed(fixed)
    },
    [selectedItem]
  )

  const handleColorChange = useCallback(
    (hex) => {
      blueprint3dRef.current?.model.checkpoint()
      selectedItem?.setColor?.(hex)
    },
    [selectedItem]
  )

  const handleItemSelect = useCallback((item) => {
    if (!blueprint3dRef.current) return
    const toastId = toast.loading(`Adding ${item.name}…`)
    const autoSelect = item.category === 'door' || item.category === 'window'
    loadingToastsRef.current.push({ toastId, itemName: item.name, autoSelect })

    const metadata = {
      itemName: item.name,
      itemKey: item.key,
      category: item.category,
      resizable: true,
      modelUrl: item.model,
      itemType: parseInt(item.type),
      // Doors/windows cut a hole in their wall by default; an item can opt out
      // (e.g. future wall-mounted decor) via an explicit `boolean: false` in the catalog.
      boolean: item.boolean !== false,
      description: item.description,
      viewerData: item.viewerData
    }

    blueprint3dRef.current.model.checkpoint()
    blueprint3dRef.current.model.scene.addItem(parseInt(item.type), item.model, metadata)
    setActiveTab('design')
    setViewMode('3d')
  }, [])

  const handleAddGeneratedItem = useCallback((kind) => {
    if (!blueprint3dRef.current) return
    const isStairs = kind === 'stairs'
    const isGroundPlane = kind === 'ground-plane'
    const isBooleanCube = kind === 'boolean-cube'
    const itemType = isStairs
      ? STAIRS_ITEM_TYPE
      : isGroundPlane
        ? GROUND_PLANE_ITEM_TYPE
        : isBooleanCube
          ? BOOLEAN_CUBE_ITEM_TYPE
          : BOOLEAN_CYLINDER_ITEM_TYPE
    const itemName = isStairs
      ? 'Stairs'
      : isGroundPlane
        ? 'Ground plane'
        : isBooleanCube
          ? 'Cube wall cutter'
          : 'Round wall cutter'

    const toastId = toast.loading(`Adding ${itemName}…`)
    // Not a file load — addGeneratedItem is synchronous — but it still
    // fires the same itemLoadedCallbacks the toast/auto-select logic above
    // listens for, so this queues into the same mechanism as catalog items.
    loadingToastsRef.current.push({ toastId, itemName, autoSelect: true })

    const metadata = isStairs
      ? { itemName, category: 'stairs', resizable: true, itemType, stairsParams: { width: 100, totalRise: 260, totalRun: 300 } }
      : isGroundPlane
        ? { itemName, category: 'ground-plane', resizable: true, itemType, groundPlaneParams: { width: 500, depth: 500 }, color: '#8ba888' }
        : {
            itemName,
            category: 'boolean-cutter',
            resizable: true,
            itemType,
            boolean: true,
            booleanCutterParams: {
              shape: isBooleanCube ? 'cube' : 'cylinder',
              width: isBooleanCube ? 90 : 80,
              height: isBooleanCube ? 90 : 80,
              depth: 24
            }
          }

    const material = isStairs
      ? createDefaultStairsMaterial()
      : isGroundPlane
        ? createDefaultGroundPlaneMaterial()
        : createBooleanCutterMaterial()

    blueprint3dRef.current.model.checkpoint()
    blueprint3dRef.current.model.scene.addGeneratedItem(itemType, metadata, material)
    setActiveTab('design')
    setViewMode('3d')
  }, [])

  const handleTextureSelect = useCallback(
    (url, stretch, scale, extra) => {
      blueprint3dRef.current?.model.checkpoint()
      currentTarget?.setTexture(url, stretch, scale, extra)
    },
    [currentTarget]
  )

  const handleUndo = useCallback(() => blueprint3dRef.current?.model.undo(), [])
  const handleRedo = useCallback(() => blueprint3dRef.current?.model.redo(), [])
  const handleZoomIn = useCallback(() => blueprint3dRef.current?.floorplanner?.zoomBy(1.25), [])
  const handleZoomOut = useCallback(() => blueprint3dRef.current?.floorplanner?.zoomBy(0.8), [])
  const handleFitView = useCallback(() => blueprint3dRef.current?.floorplanner?.fitToView(isMobile ? 76 : 56), [isMobile])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

      const key = e.key.toLowerCase()

      // Mac: Cmd+Z undo, Cmd+Shift+Z redo. Windows/Linux: Ctrl+Z undo, Ctrl+Shift+Z or
      // Ctrl+Y redo (both conventions are common there — Ctrl+Y is the Office/Windows
      // one, Ctrl+Shift+Z the one most web/creative apps use).
      const modifier = e.metaKey || e.ctrlKey
      if (!modifier) return

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((key === 'z' && e.shiftKey) || (key === 'y' && !e.metaKey)) {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  /* ---------------------------------------------------------------- *
   * Thumbnails
   * ---------------------------------------------------------------- */
  const generateTopDownThumbnail = useCallback(() => {
    return captureTopDownSnapshot(blueprint3dRef.current)
  }, [])

  /* ---------------------------------------------------------------- *
   * New / Save / Load
   * ---------------------------------------------------------------- */
  const handleConfirmNew = useCallback(async (roomType) => {
    if (!blueprint3dRef.current) return
    try {
      const template = await fetchTemplateByRoomType(roomType)
      blueprint3dRef.current.model.loadSerialized(JSON.stringify(template.layoutData))
    } catch (error) {
      console.error('Failed to load template, using bundled default:', error)
      blueprint3dRef.current.model.loadSerialized(JSON.stringify(DefaultFloorplan))
    }
    setCurrentBlueprint(null)
    setActiveTab('design')
    setViewMode('3d')
  }, [])

  const handleSave = useCallback(async () => {
    if (!currentBlueprint) {
      setSaveDialogOpen(true)
      return
    }
    if (!blueprint3dRef.current) return

    setSaving(true)
    const toastId = toast.loading('Saving floorplan…')
    try {
      const layoutData = JSON.parse(blueprint3dRef.current.model.exportSerialized())
      const thumbnailDataUrl = generateTopDownThumbnail()
      const { url: thumbnailUrl } = await uploadDataUrl(ENDPOINTS.UPLOAD_IMAGE, thumbnailDataUrl, 'thumbnail.webp')

      await updateFloorplan(currentBlueprint.id, {
        name: currentBlueprint.name,
        roomType: currentBlueprint.roomType,
        layoutData,
        thumbnailUrl
      })
      toast.success('Floorplan saved.', { id: toastId })
    } catch (error) {
      console.error('Failed to update floorplan:', error)
      toast.error('Could not save. Please try again.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }, [currentBlueprint, generateTopDownThumbnail])

  const handleSaveFloorplan = useCallback(
    async (name, roomType) => {
      if (!blueprint3dRef.current) return
      setSaving(true)
      const toastId = toast.loading('Saving floorplan…')
      try {
        const layoutData = JSON.parse(blueprint3dRef.current.model.exportSerialized())
        const thumbnailDataUrl = generateTopDownThumbnail()
        const { url: thumbnailUrl } = await uploadDataUrl(ENDPOINTS.UPLOAD_IMAGE, thumbnailDataUrl, 'thumbnail.webp')

        const result = await createFloorplan({ name, roomType, layoutData, thumbnailUrl })
        setCurrentBlueprint({ id: result.id, name, roomType })
        setSaveDialogOpen(false)
        toast.success('Floorplan saved.', { id: toastId })
      } catch (error) {
        console.error('Failed to save floorplan:', error)
        toast.error('Could not save. Please try again.', { id: toastId })
      } finally {
        setSaving(false)
      }
    },
    [generateTopDownThumbnail]
  )

  const handleOpenFloorplan = useCallback((data, roomType, id, name) => {
    if (!blueprint3dRef.current) return
    blueprint3dRef.current.model.loadSerialized(data)
    setCurrentBlueprint({ id, name, roomType: roomType || DEFAULT_ROOM_TYPE })
    setActiveTab('design')
    setViewMode('3d')
  }, [])

  const handleUnitChange = useCallback(
    (unit) => {
      Configuration.setValue(configDimUnit, unit)
      if (blueprint3dRef.current && activeTab === 'design' && viewMode === '2d') {
        blueprint3dRef.current.floorplanner?.reset()
      }
    },
    [activeTab, viewMode]
  )

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-0 right-0 top-0 z-50">
        <TopNavBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          viewMode={viewMode}
          onViewModeChange={handleViewChange}
          onSettingsClick={() => setSettingsOpen(true)}
          onRoomsClick={() => setRoomsPanelOpen(true)}
          onExportClick={() => setExportDialogOpen(true)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onSave={handleSave}
          onNew={() => setNewDialogOpen(true)}
          saving={saving}
          projectName={currentBlueprint?.name}
        />
      </div>

      <div ref={contentRef} className="relative h-full w-full overflow-hidden">
        {/* Projects tab */}
        <div className="absolute inset-0" style={{ display: activeTab === 'projects' ? 'block' : 'none' }}>
          {activeTab === 'projects' && <ProjectsView onOpenFloorplan={handleOpenFloorplan} />}
        </div>

        {/* Design + Items tabs share the same canvas underneath */}
        <div className="absolute inset-0" style={{ display: activeTab === 'design' || activeTab === 'items' ? 'block' : 'none' }}>
          <div id="viewer" ref={viewerRef} className="absolute inset-0" style={{ display: viewMode === '3d' ? 'block' : 'none' }}>
            {viewMode === '3d' && (
              <>
                <ControlsHelp viewMode="3d" />
                <RoomLabels3D blueprint3d={blueprint3dRef.current} active={engineReady && viewMode === '3d'} />
                {itemsLoading > 0 && (
                  <div id="loading-modal">
                    <div className="loading-content">
                      <p>
                        Loading
                        <span className="loading-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div id="floorplanner" className="absolute inset-0 bg-blueprint-grid" style={{ display: viewMode === '2d' ? 'block' : 'none' }}>
            <canvas id="floorplanner-canvas" ref={floorplannerCanvasRef}></canvas>
            {viewMode === '2d' && (
              <>
                <FloorplannerControls
                  mode={floorplannerMode}
                  onModeChange={handleFloorplannerModeChange}
                  onDone={handleFloorplannerDone}
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onFitView={handleFitView}
                />
                <ControlsHelp viewMode="2d" />
                <ZoomIndicator percent={zoomPercent} />
                {floorplannerMode === 'draw' && <DrawingLengthTooltip info={drawingLength} />}
                {floorplannerMode === 'cut' && <CutLengthTooltip info={cutLength} />}
                {floorplannerMode === 'measure' && <MeasureTooltip info={measureLength} />}
              </>
            )}
          </div>

          {selectedItem && !textureType && (
            <div
              className={cn(
                'absolute z-[70]',
                isMobile
                  ? 'bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] left-3 right-3'
                  : 'right-4 top-20'
              )}
            >
              <ContextMenu
                selectedItem={selectedItem}
                onDelete={handleDeleteItem}
                onResize={handleResizeItem}
                onResizeStart={handleResizeStart}
                onFixedChange={handleFixedChange}
                onColorChange={handleColorChange}
              />
            </div>
          )}

          {textureType && (
            <div
              className={cn(
                'absolute z-[70] overflow-y-auto',
                isMobile
                  ? 'bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] left-3 right-3 max-h-[46vh]'
                  : 'right-4 top-20 max-h-[calc(100vh-120px)]'
              )}
            >
              <TextureSelector type={textureType} onTextureSelect={handleTextureSelect} />
            </div>
          )}
        </div>
      </div>

      {currentBlueprint && activeTab !== 'projects' && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-40">
          <span className="rounded bg-surface/40 px-2 py-1 text-xs text-ink-muted/70 backdrop-blur-sm">{currentBlueprint.name}</span>
        </div>
      )}

      <ItemsDrawer isOpen={activeTab === 'items'} onClose={() => setActiveTab('design')} onItemSelect={handleItemSelect} onAddGenerated={handleAddGeneratedItem} />

      <RoomsPanel
        isOpen={roomsPanelOpen}
        onClose={() => setRoomsPanelOpen(false)}
        blueprint3d={blueprint3dRef.current}
        hoveredRoomUuid={hoveredRoomUuid}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        blueprint3d={blueprint3dRef.current}
        floorplanName={currentBlueprint?.name}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onUnitChange={handleUnitChange} />

      <NewFloorplanDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} onConfirm={handleConfirmNew} />

      <SaveFloorplanDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveFloorplan}
        saving={saving}
        defaultName={`Floorplan ${new Date().toLocaleDateString()}`}
        defaultRoomType={currentBlueprint?.roomType || DEFAULT_ROOM_TYPE}
      />

      {currentBlueprint?.id && (
        <RenderCarousel blueprint3dRef={blueprint3dRef} project={currentBlueprint} captureTopDownSnapshot={captureTopDownSnapshot} />
      )}
    </div>
  )
}
