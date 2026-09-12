import type { ActiveTool } from "../cornerstone/tools"
import fullscreenIcon from "../assets/tools/fullscreen.svg"
import mouseLeftIcon from "../assets/tools/mouse-left.svg"
import panIcon from "../assets/tools/pan.svg"
import resetIcon from "../assets/tools/reset.svg"
import windowLevelIcon from "../assets/tools/window-level.svg"
import zoomIcon from "../assets/tools/zoom.svg"

interface ToolbarProps {
  activeTool: ActiveTool
  disabled: boolean
  onToolChange: (tool: ActiveTool) => void
  onReset: () => void
  onFullscreen: () => void
}

const tools: Array<{ id: ActiveTool; label: string; icon: string; title: string }> = [
  {
    id: "Scroll",
    label: "Scroll",
    icon: mouseLeftIcon,
    title: "Scroll: roda do mouse ou arraste esquerdo para trocar imagens",
  },
  { id: "WindowLevel", label: "WL/WW", icon: windowLevelIcon, title: "Window/Level: ajustar janela" },
  { id: "Zoom", label: "Zoom", icon: zoomIcon, title: "Zoom: aproximar ou afastar imagem" },
  { id: "Pan", label: "Pan", icon: panIcon, title: "Pan: mover a imagem" },
]

export function Toolbar({ activeTool, disabled, onToolChange, onReset, onFullscreen }: ToolbarProps) {
  return (
    <div className="toolbar">
      {tools.map((tool) => (
        <button
          className={activeTool === tool.id ? "tool-button active" : "tool-button"}
          disabled={disabled}
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          title={tool.title}
          type="button"
        >
          <span className="tool-icons">
            <img alt="" className="tool-icon" src={tool.icon} />
          </span>
          <span className="tool-label">{tool.label}</span>
        </button>
      ))}
      <button className="tool-button" disabled={disabled} onClick={onReset} title="Reset: restaurar visualizacao" type="button">
        <span className="tool-icons">
          <img alt="" className="tool-icon" src={resetIcon} />
        </span>
        <span className="tool-label">Reset</span>
      </button>
      <button
        className="tool-button"
        disabled={disabled}
        onClick={onFullscreen}
        title="Fullscreen: tela cheia"
        type="button"
      >
        <span className="tool-icons">
          <img alt="" className="tool-icon" src={fullscreenIcon} />
        </span>
        <span className="tool-label">Fullscreen</span>
      </button>
    </div>
  )
}
