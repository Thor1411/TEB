# PDF Editor Web Application

A full-stack PDF editor built with React and Node.js. Upload PDFs, add text, draw shapes, and download your edited documents.

## 📁 Project Structure

```
TEB/
├── frontend/          # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   │   ├── PDFEditor.jsx
│   │   │   ├── PDFViewer.jsx
│   │   │   └── Toolbar.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/           # Node.js Express server
│   ├── server.js
│   └── package.json
│
└── README.md
```

## ✨ Features

- 📤 Upload PDF files
- ✏️ Add text to PDFs
- ▭ Draw rectangles on PDFs
- 📄 Navigate between pages
- 💾 Download edited PDFs
- 🎨 Modern, responsive UI

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

### Running the Application

1. **Start the Backend Server** (Terminal 1)
   ```bash
   cd backend
   npm start
   ```
   Backend will run on `http://localhost:5000`

2. **Start the Frontend Development Server** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will run on `http://localhost:3000`

3. Open your browser and navigate to `http://localhost:3000`

## 🛠️ Technologies Used

### Frontend
- **React** - UI library
- **Vite** - Build tool
- **pdf-lib** - PDF manipulation
- **pdfjs-dist** - PDF rendering

### Backend
- **Express** - Web framework
- **CORS** - Cross-origin resource sharing
- **Multer** - File upload handling
- **pdf-lib** - PDF processing

## 📝 Usage

1. Click "Upload PDF" to select a PDF file
2. Use the toolbar to:
   - Add text: Click "Add Text", enter text, then click on the PDF
   - Draw rectangle: Click "Rectangle", then click on the PDF
   - Navigate pages: Use previous/next buttons
3. Download your edited PDF using the "Download" button

## 🔧 Development

### Frontend Development
```bash
cd frontend
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend Development
```bash
cd backend
npm run dev      # Start with auto-reload (Node 18.11+)
npm start        # Start normally
```

## 📦 Build for Production

```bash
# Build frontend
cd frontend
npm run build

# The build output will be in frontend/dist
```

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT