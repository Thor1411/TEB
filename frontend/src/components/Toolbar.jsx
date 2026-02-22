import './Toolbar.css'

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
  onUndo,
  canUndo,
  currentPage,
  totalPages,
  onPageChange,
  onUploadNew,
  selectedTextId,
  updateSelectedTextBox,
  textBoxes,
  onDeselectText
}) {
  const selectedBox = selectedTextId != null
    ? textBoxes.find(b => b.id === selectedTextId)
    : null

  const isBold = (selectedBox?.fontWeight ?? 'normal') === 'bold'
  const isItalic = (selectedBox?.fontStyle ?? 'normal') === 'italic'
  const currentColor = selectedBox?.color || '#000000'

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
          className={`tool-btn rectangle-btn ${editMode === 'rectangle' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'rectangle' ? null : 'rectangle')}
          title="Draw rectangle"
        >Re
        </button>
        <button
          className={`tool-btn circle-btn ${editMode === 'circle' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'circle' ? null : 'circle')}
          title="Draw circle"
        >Ci
        </button>
        <button
          className={`tool-btn line-btn ${editMode === 'line' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'line' ? null : 'line')}
          title="Draw line"
        >Line
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
          className="tool-btn download-btn"
          onClick={onDownload}
          title="Download edited PDF"
        >Download
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
