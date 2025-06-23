'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

export default function Page() {
  const containerRef = useRef(null);
  const [xmlContent, setXmlContent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Load default sourcemap.xml from public on first render
  useEffect(() => {
    if (!xmlContent) {
      setIsLoading(true);
      fetch('/sourcemap.xml')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load default diagram');
          return res.text();
        })
        .then((data) => {
          setXmlContent(data);
          setError(null);
        })
        .catch((err) => {
          console.error('❌ Failed to fetch default XML:', err);
          setError(err.message);
        })
        .finally(() => setIsLoading(false));
    }
  }, [xmlContent]);

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        setXmlContent(e.target.result);
        setError(null);
        setIsLoading(false);
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setIsLoading(false);
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    const tryRender = () => {
      if (
        window.mxGraph &&
        window.mxUtils &&
        window.mxCodec &&
        window.mxGraphModel &&
        window.mxRubberband &&
        window.mxPanningHandler &&
        xmlContent &&
        containerRef.current
      ) {
        renderGraph(xmlContent);
        return true;
      }
      return false;
    };
    const interval = setInterval(() => {
      if (tryRender()) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [xmlContent]);

  const renderGraph = (xml) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const diagramNode = doc.getElementsByTagName('diagram')[0];
      if (!diagramNode) throw new Error('No diagram found in XML');

      const diagramXml = diagramNode.innerHTML || new XMLSerializer().serializeToString(diagramNode.firstChild);
      const xmlDoc = mxUtils.parseXml(diagramXml);
      const codec = new mxCodec(xmlDoc);
      const model = new mxGraphModel();
      codec.decode(xmlDoc.documentElement, model);

      const container = containerRef.current;
      container.innerHTML = '';

      const graph = new mxGraph(container, model);
      window.graph = graph;

      graph.setHtmlLabels(true);
      graph.setConnectable(false);
      graph.setPanning(true);
      graph.panningHandler.useLeftButtonForPanning = true;
      graph.setTooltips(true);
      graph.setEnabled(true);
      graph.setCellsResizable(false);
      graph.setCellsMovable(false);
      graph.setCellsEditable(false);

      new mxPanningHandler(graph);
      new mxRubberband(graph);

      container.style.cursor = 'grab';
      container.addEventListener('mousedown', () => container.style.cursor = 'grabbing');
      container.addEventListener('mouseup', () => container.style.cursor = 'grab');

      graph.getModel().beginUpdate();
      try {
        graph.refresh();
        setTimeout(() => fitDiagramToView(), 300);
      } finally {
        graph.getModel().endUpdate();
      }
    } catch (err) {
      console.error('Error rendering graph:', err);
      setError('Failed to render diagram');
    }
  };

  const fitDiagramToView = () => {
    const graph = window.graph;
    const container = containerRef.current;
    if (!graph || !container) return;

    const bounds = graph.getGraphBounds();
    if (bounds.width === 0 || bounds.height === 0) return;

    const padding = 20;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const scaleX = (containerWidth - padding * 2) / bounds.width;
    const scaleY = (containerHeight - padding * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1);

    graph.view.setScale(scale);
    graph.view.setTranslate(-bounds.x + padding / scale, -bounds.y + padding / scale);

    container.scrollLeft = bounds.x * scale - padding;
    container.scrollTop = bounds.y * scale - padding;

    setZoomLevel(Math.round(scale * 100));
  };

  const handleZoomIn = () => {
    if (window.graph) {
      window.graph.zoomIn();
      setZoomLevel(Math.round(window.graph.view.scale * 100));
    }
  };

  const handleZoomOut = () => {
    if (window.graph) {
      window.graph.zoomOut();
      setZoomLevel(Math.round(window.graph.view.scale * 100));
    }
  };

  const handleFitView = () => fitDiagramToView();

  const handleActualSize = () => {
    if (window.graph) {
      window.graph.zoomActual();
      setZoomLevel(100);
    }
  };

  return (
    <>
      <Script src="https://unpkg.com/mxgraph/javascript/mxClient.min.js" strategy="beforeInteractive" />
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Process Map Viewer</h1>
          <p className="text-sm text-gray-600 mt-1">Interactive business process visualization</p>
        </header>

        <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <button onClick={handleZoomIn} className="toolbar-btn">Zoom In</button>
            <button onClick={handleZoomOut} className="toolbar-btn">Zoom Out</button>
            <button onClick={handleFitView} className="toolbar-btn">Fit to View</button>
            <button onClick={handleActualSize} className="toolbar-btn">Actual Size</button>
          </div>
          <div className="flex items-center space-x-4">
            <label className="text-sm text-gray-700 font-medium">Upload XML:
              <input type="file" accept=".xml" onChange={handleFileUpload} className="ml-2" />
            </label>
            <span className="text-sm text-gray-600">Zoom: <span className="font-medium">{zoomLevel}%</span></span>
          </div>
        </div>

        <main className="flex-1">
          <div
            ref={containerRef}
            style={{
              height: 'calc(100vh - 120px)',
              width: '100%',
              overflow: 'auto',
              position: 'relative',
              backgroundColor: '#f9f9f9',
              cursor: 'grab'
            }}
          />
        </main>
      </div>

      <style jsx>{`
        .toolbar-btn {
          padding: 0.5rem 0.75rem;
          border: 1px solid #ccc;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.375rem;
          background-color: white;
          color: #333;
          margin-bottom:16px;
          transition: background-color 0.2s;
        }
        .toolbar-btn:hover {
          background-color: #f0f0f0;
        }
      `}</style>
    </>
  );
}
