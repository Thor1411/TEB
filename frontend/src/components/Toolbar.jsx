import './Toolbar.css'

function Toolbar({
  editMode,
  setEditMode,
  fontSize,
  setFontSize,
  onApplyText,
  hasTextBoxes,
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
  onUploadNew
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <button 
          className="tool-btn"
          onClick={onUploadNew}
          title="Upload new PDF"
        >
          📁 New PDF
        </button>
        <button 
          className="tool-btn undo-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo last action (Ctrl+Z)"
        >
          ↶ Undo
        </button>
      </div>

      <div className="toolbar-section shapes-section">
        <button
          className={`tool-btn text-btn ${editMode === 'text' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'text' ? null : 'text')}
          title="Add text (click on PDF to add text box)"
        >
          ✏️ Text
        </button>
        {editMode === 'text' && (
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
          >
            ✓ Apply Text
          </button>
        )}
        <button
          className="tool-btn image-btn"
          onClick={onImageUpload}
          title="Add image (click to upload)"
        >
          🖼️ Image
        </button>
        {hasImages && (
          <button
            className="tool-btn apply-image-btn"
            onClick={onApplyImages}
            title="Apply all images to PDF"
          >
            ✓ Apply Images
          </button>
        )}
        <button
          className={`tool-btn rectangle-btn ${editMode === 'rectangle' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'rectangle' ? null : 'rectangle')}
          title="Draw rectangle"
        >
          ▭ Rectangle
        </button>
        <button
          className={`tool-btn circle-btn ${editMode === 'circle' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'circle' ? null : 'circle')}
          title="Draw circle"
        >
          ⭕ Circle
        </button>
        <button
          className={`tool-btn line-btn ${editMode === 'line' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'line' ? null : 'line')}
          title="Draw line"
        >
          📏 Line
        </button>
        <button
          className={`tool-btn highlight-btn ${editMode === 'highlight' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'highlight' ? null : 'highlight')}
          title="Drag to highlight (draw mode)"
        >
          🖍️ Draw Highlight
        </button>
        <button
          className={`tool-btn highlight-select-btn ${editMode === 'highlight-select' ? 'active' : ''}`}
          onClick={() => setEditMode(editMode === 'highlight-select' ? null : 'highlight-select')}
          title="Select text to highlight"
        >
          🔍 Select & Highlight
        </button>
        {hasTextSelections && (
          <button
            className="tool-btn apply-highlight-btn"
            onClick={onApplyHighlights}
            title="Apply all text highlights to PDF"
          >
            ✓ Apply Highlights
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
        >
          💾 Download
        </button>
      </div>
    </div>
  )
}

export default Toolbar
