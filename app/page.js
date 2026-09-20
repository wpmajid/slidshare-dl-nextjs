'use client';

import { useState } from 'react';
import {
  RESOLUTIONS,
  buildImageUrl,
  mapWithConcurrency,
  fetchSlideBlob,
  jpegBlobToPngBlob,
  buildZip,
  buildPdf,
  buildPptx,
  downloadBlob,
} from '../lib/downloader';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [resolution, setResolution] = useState('638');
  const [format, setFormat] = useState('pdf');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleFetch(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch('/api/get-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideshareUrl: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch slides.');
      setData(json);
      setSelected(new Set(json.slideImagesPreview.map((_, i) => i)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSlide(idx) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(data.slideImagesPreview.map((_, i) => i)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function handleGenerate() {
    if (!data) return;
    const indices = [...selected].sort((a, b) => a - b);
    if (indices.length === 0) {
      setError('Select at least one slide.');
      return;
    }
    setGenerating(true);
    setError('');
    setProgress({ done: 0, total: indices.length });
    try {
      const urls = indices.map((idx) => buildImageUrl(data.slideshowInfo, resolution, idx + 1));
      const blobs = await mapWithConcurrency(urls, 8, async (imgUrl) => {
        const blob = await fetchSlideBlob(imgUrl);
        setProgress((p) => ({ ...p, done: p.done + 1 }));
        return blob;
      });

      const stamp = Date.now();
      if (format === 'pdf') {
        downloadBlob(await buildPdf(blobs), `slides_${stamp}.pdf`);
      } else if (format === 'pptx') {
        downloadBlob(await buildPptx(blobs), `slides_${stamp}.pptx`);
      } else if (format === 'png') {
        const pngBlobs = await mapWithConcurrency(blobs, 4, (b) => jpegBlobToPngBlob(b));
        downloadBlob(await buildZip(pngBlobs, 'png'), `slides_${stamp}.zip`);
      } else {
        downloadBlob(await buildZip(blobs, 'jpg'), `slides_${stamp}.zip`);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate file.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="container">
      <h1>SlideShare Downloader</h1>
      <p className="subtitle">
        Paste a SlideShare link, pick slides, and export as PDF, PPTX or ZIP — all processed in your browser.
      </p>

      <form className="url-form" onSubmit={handleFetch}>
        <input
          type="url"
          required
          placeholder="https://www.slideshare.net/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Fetching…' : 'Fetch Slides'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {data && (
        <>
          <div className="toolbar">
            <button type="button" className="secondary" onClick={selectAll}>
              Select all
            </button>
            <button type="button" className="secondary" onClick={selectNone}>
              Select none
            </button>
            <label>
              Resolution
              <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                {Object.entries(RESOLUTIONS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Format
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="pdf">PDF</option>
                <option value="pptx">PPTX</option>
                <option value="jpg">ZIP (JPG)</option>
                <option value="png">ZIP (PNG)</option>
              </select>
            </label>
            <button type="button" onClick={handleGenerate} disabled={generating || selected.size === 0}>
              {generating ? 'Generating…' : `Download (${selected.size})`}
            </button>
          </div>

          {generating && (
            <div className="progress">
              Downloading slides: {progress.done} / {progress.total}
            </div>
          )}

          <div className="grid">
            {data.slideImagesPreview.map((src, idx) => (
              <div
                key={idx}
                className={`thumb${selected.has(idx) ? ' selected' : ''}`}
                onClick={() => toggleSlide(idx)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Slide ${idx + 1}`} loading="lazy" />
                <span className="badge">{idx + 1}</span>
                <span className="check">{selected.has(idx) ? '✓' : ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
