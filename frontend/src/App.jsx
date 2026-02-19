import { useState } from 'react'
import PDFEditor from './components/PDFEditor'
import './App.css'

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <h1>📄 PDF Editor</h1>
        <p>Upload, edit, and download your PDF files</p>
      </header>
      <PDFEditor />
    </div>
  )
}

export default App
