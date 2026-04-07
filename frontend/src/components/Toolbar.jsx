import './Toolbar.css'
import { useEffect, useState } from 'react'

function Toolbar({
  editMode,
  setEditMode,
  fontSize,
  setFontSize,
  onApplyText,
  hasTextBoxes,
  fontFamily,
  setFontFamily,
  onApplyImages,
  hasImages,
  onImageUpload,
  onApplyHighlights,
  hasTextSelections,
  onDownload,
  onSecureRedact,
  canSecureRedact,
  onEmbeddedSign,
  embeddedSignDisabled,
  onInspectEmbeddedSignature,
  onUndo,
  canUndo,
  currentPage,
  totalPages,
  onPageChange,
  onUploadNew,
  onLogout,
  selectedTextId,
  updateSelectedTextBox,
  textBoxes,
  onDeselectText,
  selectedRectangleId,
  rectangleBoxes,
  updateSelectedRectangleBox,
  onDeselectRectangle,
  onRemoveRectangleBox,
  selectedCircleId,
  circleBoxes,
  updateSelectedCircleBox,
  onDeselectCircle,
  onRemoveCircleBox,
  selectedLineId,
  lineBoxes,
  updateSelectedLineBox,
  onDeselectLine,
  onRemoveLineBox
}) {
  const [showDrawTools, setShowDrawTools] = useState(false)

  const selectedBox = selectedTextId != null
    ? textBoxes.find(b => b.id === selectedTextId)
    : null

  const isBold = (selectedBox?.fontWeight ?? 'normal') === 'bold'
  const isItalic = (selectedBox?.fontStyle ?? 'normal') === 'italic'
  const currentColor = selectedBox?.color || '#000000'

  const selectedRect = selectedRectangleId != null
    ? (rectangleBoxes || []).find(b => b.id === selectedRectangleId)
    : null

  const rectStrokeColor = selectedRect?.strokeColor || '#000000'
  const rectFillColor = selectedRect?.fillColor || '#000000'
  const rectFilled = selectedRect?.filled === true
  const rectStrokeWidth = selectedRect?.strokeWidth ?? 2

  const selectedCircle = selectedCircleId != null
    ? (circleBoxes || []).find(b => b.id === selectedCircleId)
    : null
  const circleStrokeColor = selectedCircle?.strokeColor || '#000000'
  const circleFillColor = selectedCircle?.fillColor || '#000000'
  const circleFilled = selectedCircle?.filled === true
  const circleStrokeWidth = selectedCircle?.strokeWidth ?? 2

  const selectedLine = selectedLineId != null
    ? (lineBoxes || []).find(b => b.id === selectedLineId)
    : null
  const lineStrokeColor = selectedLine?.strokeColor || '#000000'
  const lineStrokeWidth = selectedLine?.strokeWidth ?? 2

  useEffect(() => {
    // Hide draw tools when switching into other modes
    if (
      editMode !== 'rectangle' &&
      editMode !== 'circle' &&
      editMode !== 'line'
    ) {
      setShowDrawTools(false)
    }
  }, [editMode])

  return (
    <>
    <div className="toolbar">
      <div className="toolbar-section">
        <button 
          className="tool-btn"
          onClick={onUploadNew}
          title="Upload new PDF"
        >Open New PDF
        </button>
        <button 
          className="tool-btn undo-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo last action (Ctrl+Z)"
        >Undo
        </button>
      </div>

      <div className="toolbar-section shapes-section">
        <button
          className={`tool-btn text-btn ${editMode === 'text' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'text' ? null : 'text')}
          title="Add text (click on PDF to add text box)"
        ><img src="/images/text_logo.png" alt="Add Text" className="tool-icon" />
        </button>
        {/* {editMode === 'text' && (
          <div className="text-controls">
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="font-size-select"
              title="Font size"
            >
              <option value={12}>12px</option>
              <option value={14}>14px</option>
              <option value={16}>16px</option>
              <option value={18}>18px</option>
              <option value={20}>20px</option>
              <option value={24}>24px</option>
              <option value={28}>28px</option>
              <option value={32}>32px</option>
              <option value={36}>36px</option>
              <option value={48}>48px</option>
            </select>
          </div>
        )}
        {hasTextBoxes && (
          <button
            className="tool-btn apply-text-btn"
            onClick={onApplyText}
            title="Apply all text boxes to PDF"
          >Apply Text
          </button>
        )} */}
        <button
          className="tool-btn image-btn"
          onClick={onImageUpload}
          title="Add image (click to upload)"
        ><img src="/images/img_logo.png" alt="Add Image" className="tool-icon" />
        </button>
        {/* {hasImages && (
          <button
            className="tool-btn apply-image-btn"
            onClick={onApplyImages}
            title="Apply all images to PDF"
          >Apply Images
          </button>
        )} */}
        <button
          className={`tool-btn draw-tools-btn ${showDrawTools || editMode === 'rectangle' || editMode === 'circle' || editMode === 'line' ? 'active' : ''}`}
          onClick={() => {
            const next = !showDrawTools
            setShowDrawTools(next)
            if (!next && (editMode === 'rectangle' || editMode === 'circle' || editMode === 'line')) {
              setEditMode(null)
            }
          }}
          title="Draw tools"
        ><img src="/images/shape_logo.png" alt="Add Shape" className="tool-icon" />
        </button>
        <button
          className={`tool-btn highlight-btn ${editMode === 'highlight' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'highlight' ? null : 'highlight')}
          title="Drag to highlight (draw mode)"
        ><img src="/images/pen_logo.png" alt="Add Highlight" className="tool-icon" />
        </button>
        <button
          className={`tool-btn highlight-select-btn ${editMode === 'highlight-select' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'highlight-select' ? null : 'highlight-select')}
          title="Select text to highlight"
        >Select & Highlight
        </button>
        {hasTextSelections && (
          <button
            className="tool-btn apply-highlight-btn"
            onClick={onApplyHighlights}
            title="Apply all text highlights to PDF"
          >Apply Highlights
          </button>
        )}
      </div>

      

       <div className="toolbar-section pagination">
        <button
          className="nav-btn"
          onClick={() => onPageChange('prev')}
          disabled={currentPage === 1}
        >
          ◀
        </button>
        <span className="page-info">
          Page {currentPage} / {totalPages}
        </span>
        <button
          className="nav-btn"
          onClick={() => onPageChange('next')}
          disabled={currentPage === totalPages}
        >
          ▶
        </button>
      </div>

      <div className="toolbar-section">
        <button
          className="tool-btn"
          onClick={onSecureRedact}
          disabled={!canSecureRedact}
          title="Burn filled rectangles into the PDF (server-side redaction)"
        >Secure Redact
        </button>
        <button
          className="tool-btn"
          onClick={onEmbeddedSign}
          disabled={embeddedSignDisabled}
          title="Create an embedded PDF signature (server-side)"
        >Sign (Embedded)
        </button>
        <button
          className="tool-btn"
          onClick={onInspectEmbeddedSignature}
          title="Quick check for an embedded signature marker"
        >Inspect Signature
        </button>
        <button 
          className="tool-btn download-btn"
          onClick={onDownload}
          title="Download edited PDF"
        >Download
        </button>
        <button
          className="tool-btn"
          onClick={onLogout}
          title="Logout"
        >Logout
        </button>
      </div>
    </div>
    {/* SECONDARY TOOLBAR - TEXT SELECTION */}
      {selectedTextId != null && (
        <div className="secondary-toolbar">
          <select
            className="font-size-select"
            value={
              selectedBox?.fontSize || fontSize
            }
            onChange={(e) => {
              const nextSize = Number(e.target.value)
              updateSelectedTextBox({ fontSize: nextSize })
            }}
          >
          <option value={12}>12px</option>
          <option value={14}>14px</option>
          <option value={16}>16px</option>
          <option value={18}>18px</option>
          <option value={20}>20px</option>
          <option value={24}>24px</option>
          <option value={28}>28px</option>
          <option value={32}>32px</option>
          <option value={36}>36px</option>
          <option value={48}>48px</option>
          </select>
          <select
            className="font-select"
            value={
              selectedBox?.fontFamily || fontFamily
            }
            onChange={(e) => {
              const nextFamily = e.target.value
              updateSelectedTextBox({ fontFamily: nextFamily })
            }}
          >
            <option value="helvetica">Helvetica</option>
            <option value="times">Times</option>
            <option value="courier">Courier</option>
            <option value="roboto-condensed">Roboto Condensed</option>
            <option value="oswald">Oswald</option>
            <option value="inter">Inter</option>
            <option value="poppins">Poppins</option>
            <option value="lato">Lato</option>
          </select>

          <button
            type="button"
            className={`tool-btn style-toggle-btn ${isBold ? 'active' : ''}`}
            onClick={() => {
              updateSelectedTextBox({ fontWeight: isBold ? 'normal' : 'bold' })
            }}
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            className={`tool-btn style-toggle-btn ${isItalic ? 'active' : ''}`}
            onClick={() => {
              updateSelectedTextBox({ fontStyle: isItalic ? 'normal' : 'italic' })
            }}
            title="Italic"
          >
            I
          </button>

          <input
            type="color"
            className="color-input"
            value={currentColor}
            onChange={(e) => {
              updateSelectedTextBox({ color: e.target.value })
            }}
            title="Text color"
          />

          <button
            className="tool-btn apply-text-btn"
            onClick={() => {
              onApplyText()
              if (onDeselectText) onDeselectText()
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* SECONDARY TOOLBAR - RECTANGLE SELECTION */}
      {selectedTextId == null && selectedRectangleId != null && (
        <div className="secondary-toolbar">
          <button
            type="button"
            className={`tool-btn style-toggle-btn ${rectFilled ? 'active' : ''}`}
            onClick={() => {
              updateSelectedRectangleBox({ filled: !rectFilled })
            }}
            title="Solid fill"
          >
            Solid
          </button>

          <label className="secondary-label">Fill</label>
          <input
            type="color"
            className="color-input"
            value={rectFillColor}
            onChange={(e) => updateSelectedRectangleBox({ fillColor: e.target.value })}
            title="Fill color"
            disabled={!rectFilled}
          />

          <label className="secondary-label">Stroke</label>
          <input
            type="color"
            className="color-input"
            value={rectStrokeColor}
            onChange={(e) => updateSelectedRectangleBox({ strokeColor: e.target.value })}
            title="Stroke color"
          />

          <select
            className="font-size-select"
            value={rectStrokeWidth}
            onChange={(e) => updateSelectedRectangleBox({ strokeWidth: Number(e.target.value) })}
            title="Stroke width"
          >
            <option value={1}>1px</option>
            <option value={2}>2px</option>
            <option value={3}>3px</option>
            <option value={4}>4px</option>
            <option value={6}>6px</option>
            <option value={8}>8px</option>
            <option value={10}>10px</option>
          </select>

          <button
            type="button"
            className="tool-btn"
            onClick={() => {
              if (onRemoveRectangleBox && selectedRectangleId != null) onRemoveRectangleBox(selectedRectangleId)
            }}
            title="Delete rectangle"
          >
            Delete
          </button>

          <button
            type="button"
            className="tool-btn apply-text-btn"
            onClick={() => {
              if (onDeselectRectangle) onDeselectRectangle()
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* SECONDARY TOOLBAR - CIRCLE SELECTION */}
      {selectedTextId == null && selectedRectangleId == null && selectedCircleId != null && (
        <div className="secondary-toolbar">
          <button
            type="button"
            className={`tool-btn style-toggle-btn ${circleFilled ? 'active' : ''}`}
            onClick={() => {
              updateSelectedCircleBox({ filled: !circleFilled })
            }}
            title="Solid fill"
          >
            Solid
          </button>

          <label className="secondary-label">Fill</label>
          <input
            type="color"
            className="color-input"
            value={circleFillColor}
            onChange={(e) => updateSelectedCircleBox({ fillColor: e.target.value })}
            title="Fill color"
            disabled={!circleFilled}
          />

          <label className="secondary-label">Stroke</label>
          <input
            type="color"
            className="color-input"
            value={circleStrokeColor}
            onChange={(e) => updateSelectedCircleBox({ strokeColor: e.target.value })}
            title="Stroke color"
          />

          <select
            className="font-size-select"
            value={circleStrokeWidth}
            onChange={(e) => updateSelectedCircleBox({ strokeWidth: Number(e.target.value) })}
            title="Stroke width"
          >
            <option value={1}>1px</option>
            <option value={2}>2px</option>
            <option value={3}>3px</option>
            <option value={4}>4px</option>
            <option value={6}>6px</option>
            <option value={8}>8px</option>
            <option value={10}>10px</option>
          </select>

          <button
            type="button"
            className="tool-btn"
            onClick={() => {
              if (onRemoveCircleBox && selectedCircleId != null) onRemoveCircleBox(selectedCircleId)
            }}
            title="Delete circle"
          >
            Delete
          </button>

          <button
            type="button"
            className="tool-btn apply-text-btn"
            onClick={() => {
              if (onDeselectCircle) onDeselectCircle()
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* SECONDARY TOOLBAR - LINE SELECTION */}
      {selectedTextId == null && selectedRectangleId == null && selectedCircleId == null && selectedLineId != null && (
        <div className="secondary-toolbar">
          <label className="secondary-label">Stroke</label>
          <input
            type="color"
            className="color-input"
            value={lineStrokeColor}
            onChange={(e) => updateSelectedLineBox({ strokeColor: e.target.value })}
            title="Line color"
          />

          <select
            className="font-size-select"
            value={lineStrokeWidth}
            onChange={(e) => updateSelectedLineBox({ strokeWidth: Number(e.target.value) })}
            title="Stroke width"
          >
            <option value={1}>1px</option>
            <option value={2}>2px</option>
            <option value={3}>3px</option>
            <option value={4}>4px</option>
            <option value={6}>6px</option>
            <option value={8}>8px</option>
            <option value={10}>10px</option>
          </select>

          <button
            type="button"
            className="tool-btn"
            onClick={() => {
              if (onRemoveLineBox && selectedLineId != null) onRemoveLineBox(selectedLineId)
            }}
            title="Delete line"
          >
            Delete
          </button>

          <button
            type="button"
            className="tool-btn apply-text-btn"
            onClick={() => {
              if (onDeselectLine) onDeselectLine()
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* SECONDARY TOOLBAR - DRAW TOOLS */}
      {selectedTextId == null && selectedRectangleId == null && selectedCircleId == null && selectedLineId == null && showDrawTools && (
        <div className="secondary-toolbar">
          <button
            type="button"
            className={`tool-btn rectangle-btn ${editMode === 'rectangle' ? 'active' : ''}`}
            onClick={() => setEditMode('rectangle')}
            title="Draw rectangle"
          ><img src="/images/rect_logo.png" alt="Add Rectangle" className="tool-icon" />
          </button>
          <button
            type="button"
            className={`tool-btn circle-btn ${editMode === 'circle' ? 'active' : ''}`}
            onClick={() => setEditMode('circle')}
            title="Draw circle"
          ><img src="/images/cir_logo.png" alt="Add Circle" className="tool-icon" />
          </button>
          <button
            type="button"
            className={`tool-btn line-btn ${editMode === 'line' ? 'active' : ''}`}
            onClick={() => setEditMode('line')}
            title="Draw line"
          ><img src="/images/line_logo.png" alt="Add Line" className="tool-icon" />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => {
              setShowDrawTools(false)
              if (editMode === 'rectangle' || editMode === 'circle' || editMode === 'line') {
                setEditMode(null)
              }
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* SECONDARY TOOLBAR - IMAGE MODE */}
        {editMode === 'image' && (
  <div className="secondary-toolbar">
    {hasImages && (
      <button
        className="tool-btn apply-image-btn"
        onClick={onApplyImages}
      >
        Apply Images
      </button>
    )}

    <button
      className="tool-btn"
      onClick={() => setEditMode(null)}
    >
      Cancel
    </button>
  </div>
          )}
    </>  
  )
}

export default Toolbar
