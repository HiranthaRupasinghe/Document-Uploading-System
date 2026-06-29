import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { X, Maximize2, Minimize2, Download, FileText, Loader2, AlertTriangle } from 'lucide-react';

export const DocumentPreview = ({ file, onClose, onDownload }) => {
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isOfficeDoc, setIsOfficeDoc] = useState(false);

  useEffect(() => {
    let url = null;
    const fetchPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/files/preview/${file.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to load file preview.');
        }

        const blob = await response.blob();
        
        const fileNameLower = file.originalName.toLowerCase();
        const isOffice = fileNameLower.endsWith('.docx') || 
                         fileNameLower.endsWith('.doc') || 
                         fileNameLower.endsWith('.xlsx') || 
                         fileNameLower.endsWith('.xls') || 
                         fileNameLower.endsWith('.pptx') || 
                         fileNameLower.endsWith('.ppt');

        if (isOffice) {
          setIsOfficeDoc(true);
          
          // Create form data to upload blob to tmpfiles.org
          const formData = new FormData();
          const fileToUpload = new File([blob], file.originalName, { type: file.mimeType });
          formData.append('file', fileToUpload);

          const uploadResponse = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
          });

          if (!uploadResponse.ok) {
            throw new Error('Office Document Viewer failed to load the file preview.');
          }

          const uploadData = await uploadResponse.json();
          if (uploadData.status === 'success') {
            const rawUrl = uploadData.data.url;
            const directDownloadUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(directDownloadUrl)}`;
            setPreviewUrl(viewerUrl);
          } else {
            throw new Error('Could not upload file to preview server.');
          }
        } else {
          setIsOfficeDoc(false);
          // Force the correct MIME type for the blob
          const pdfBlob = new Blob([blob], { type: file.mimeType });
          url = URL.createObjectURL(pdfBlob);
          setPreviewUrl(url);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();

    // Cleanup object URL
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file.id, file.mimeType, file.originalName, token]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const renderPreviewContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Loader2 className="animate-spin" size={48} style={{ color: '#818cf8' }} />
          <p style={{ color: '#94a3b8' }}>Loading document preview...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="preview-unsupported">
          <AlertTriangle size={48} style={{ color: '#f87171' }} />
          <p>{error}</p>
          <button className="btn-secondary" onClick={onDownload}>
            Download File Instead
          </button>
        </div>
      );
    }

    if (isOfficeDoc) {
      return (
        <iframe 
          src={previewUrl} 
          title={file.originalName} 
          className="preview-frame" 
          style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff', borderRadius: '8px' }}
        />
      );
    }

    const isImage = file.mimeType.startsWith('image/');
    const isPdf = file.mimeType === 'application/pdf';

    if (isImage) {
      return <img src={previewUrl} alt={file.originalName} className="preview-image" />;
    }

    if (isPdf) {
      // Use <embed> instead of <iframe> for PDFs, as Chrome/Edge handles blob URLs in <embed> much better
      return <embed src={previewUrl} type="application/pdf" className="preview-frame" />;
    }

    // Default fallback: Try to render inside an iframe for all other document types (Text, JSON, HTML, etc.)
    return <iframe src={previewUrl} title={file.originalName} className="preview-frame" />;
  };

  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div
        className={`preview-container ${isFullscreen ? 'fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="preview-header">
          <div className="preview-title">
            <FileText size={20} style={{ color: '#818cf8' }} />
            <span>{file.originalName}</span>
          </div>
          <div className="preview-controls">
            <button
              className="control-btn"
              onClick={onDownload}
              title="Download File"
            >
              <Download size={18} />
            </button>
            <button
              className="control-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              className="control-btn control-btn-close"
              onClick={onClose}
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="preview-body">
          {renderPreviewContent()}
        </div>
      </div>
    </div>
  );
};
export default DocumentPreview;
