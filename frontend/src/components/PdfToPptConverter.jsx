import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pptxgen from 'pptxgenjs';

// Set up the PDF.js worker (required for it to function correctly in the browser)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PdfToPptConverter = () => {
  const [isConverting, setIsConverting] = useState(false);
  const canvasRef = useRef(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }

    setIsConverting(true);

    try {
      // 1. Read the PDF file
      const fileReader = new FileReader();
      fileReader.onload = async function (e) {
        const typedarray = new Uint8Array(e.target.result);
        
        // 2. Load the PDF using pdf.js
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const totalPages = pdf.numPages;
        
        // 3. Initialize PowerPoint generator
        const pptx = new pptxgen();

        // 4. Loop through each page of the PDF
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          
          // Set scale for image quality (higher is better but makes file larger)
          const viewport = page.getViewport({ scale: 2.0 });
          
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Render PDF page to canvas
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          await page.render(renderContext).promise;

          // Convert canvas to base64 image data
          const imageData = canvas.toDataURL('image/png');

          // 5. Add a slide to the PPT and insert the image
          const slide = pptx.addSlide();
          slide.addImage({ 
            data: imageData, 
            x: 0, 
            y: 0, 
            w: '100%', 
            h: '100%',
            sizing: { type: 'contain' } // Ensures the image fits within the slide
          });
        }

        // 6. Save the PowerPoint file
        await pptx.writeFile({ fileName: `${file.name.replace('.pdf', '')}.pptx` });
        setIsConverting(false);
        // Reset the input value so the same file can be selected again if needed
        event.target.value = null; 
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error converting PDF to PPT:', error);
      alert('An error occurred during conversion.');
      setIsConverting(false);
      event.target.value = null;
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        id="pdf-upload"
        accept="application/pdf" 
        onChange={handleFileUpload} 
        disabled={isConverting}
        style={{ display: 'none' }}
      />
      
      {/* Stylized Label acting as the upload button */}
      <label 
        htmlFor="pdf-upload"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#4A6B82', 
          border: '2px solid #8B999E', 
          color: '#E5D5C5', 
          padding: '1.5rem 3rem',
          borderRadius: '4px',
          fontSize: '0.9rem',
          fontWeight: '400',
          cursor: isConverting ? 'not-allowed' : 'pointer',
          opacity: isConverting ? 0.8 : 1,
          width: '100%',
          maxWidth: '400px',
          boxSizing: 'border-box',
          textAlign: 'center',
          transition: 'opacity 0.2s ease-in-out'
        }}
      >
        {isConverting ? 'Converting to PPT... Please wait' : 'Click to select a PDF file to convert to PPT'}
      </label>

      {/* Invisible placeholder to match the height of the layout when converting */}
      {isConverting && (
        <div style={{ marginTop: '20px', width: '100%', maxWidth: '800px', height: '20px' }}></div>
      )}

      {/* Hidden canvas used for rendering PDF pages */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default PdfToPptConverter;