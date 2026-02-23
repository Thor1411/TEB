import React, { useState } from 'react';

const PptToPdfConverter = () => {
  const [isConverting, setIsConverting] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    
    // Validate it's a PowerPoint file
    if (!file || (!file.name.endsWith('.ppt') && !file.name.endsWith('.pptx'))) {
      alert('Please upload a valid PPT or PPTX file.');
      return;
    }

    setIsConverting(true);

    // Prepare the file to be sent to the backend
    const formData = new FormData();
    formData.append('pptFile', file);

    try {
      // Send to our Node.js backend route
      const response = await fetch('http://localhost:5000/api/convert-ppt-to-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Conversion failed on the server.');

      // Receive the PDF file as a blob and trigger the download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${file.name.replace(/\.pptx?$/, '')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred during conversion. Is your backend server running?');
    } finally {
      setIsConverting(false);
      // Reset the input so the user can upload the same file again if needed
      event.target.value = null; 
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        id="ppt-upload"
        accept=".ppt, .pptx, application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation" 
        onChange={handleFileUpload} 
        disabled={isConverting}
        style={{ display: 'none' }}
      />
      
      {/* Stylized Label acting as the upload button */}
      <label 
        htmlFor="ppt-upload"
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
        {isConverting ? 'Converting to PDF... Please wait' : 'Click to select a PPT file to convert to PDF'}
      </label>

      {/* Invisible placeholder to match the height of the other component's progress bar when it appears */}
      {isConverting && (
        <div style={{ marginTop: '20px', width: '100%', maxWidth: '800px', height: '20px' }}></div>
      )}
    </div>
  );
};

export default PptToPdfConverter;