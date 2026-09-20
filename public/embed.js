/*!
 * SlideShare Downloader - embeddable widget.
 * Paste into a WordPress "Custom HTML" block along with the CDN <script> tags
 * for JSZip, jsPDF and PptxGenJS (see README for the exact snippet). This
 * script calls the two API routes on this same project (get-slides,
 * proxy-image) and does the actual ZIP/PDF/PPTX assembly in the visitor's
 * browser, so the API stays a cheap, stateless proxy.
 */
(function () {
  var scriptEl = document.currentScript;
  var apiBase = (scriptEl && scriptEl.getAttribute('data-api-base')) || '';
  var containerId = (scriptEl && scriptEl.getAttribute('data-target')) || 'ssdl-app';

  var RESOLUTIONS = {
    '320': { width: 320, quality: 85, label: 'Low (320px)' },
    '638': { width: 638, quality: 85, label: 'Medium (638px)' },
    '2048': { width: 2048, quality: 75, label: 'High (2048px)' },
  };

  function injectStyles() {
    if (document.getElementById('ssdl-styles')) return;
    var style = document.createElement('style');
    style.id = 'ssdl-styles';
    style.textContent =
      '.ssdl-widget{max-width:900px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1e293b}' +
      '.ssdl-form{display:flex;gap:8px;margin-bottom:12px}' +
      '.ssdl-form input{flex:1;padding:10px 12px;border-radius:8px;border:1px solid #cbd5e1;font-size:14px}' +
      '.ssdl-widget button{padding:10px 16px;border-radius:8px;border:none;background:#6366f1;color:#fff;font-weight:600;font-size:14px;cursor:pointer}' +
      '.ssdl-widget button:disabled{opacity:.5;cursor:not-allowed}' +
      '.ssdl-widget button.ssdl-secondary{background:#e2e8f0;color:#1e293b}' +
      '.ssdl-error{display:none;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:14px}' +
      '.ssdl-error.ssdl-visible{display:block}' +
      '.ssdl-results{display:none}' +
      '.ssdl-results.ssdl-visible{display:block}' +
      '.ssdl-toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px;padding:12px;background:#f8fafc;border-radius:10px}' +
      '.ssdl-toolbar label{font-size:12px;color:#64748b;display:flex;flex-direction:column;gap:4px}' +
      '.ssdl-toolbar select{padding:8px 10px;border-radius:6px;border:1px solid #cbd5e1}' +
      '.ssdl-progress{font-size:13px;color:#64748b;margin-bottom:8px;display:none}' +
      '.ssdl-progress.ssdl-visible{display:block}' +
      '.ssdl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}' +
      '.ssdl-thumb{position:relative;border-radius:8px;overflow:hidden;border:2px solid transparent;cursor:pointer;background:#f1f5f9}' +
      '.ssdl-thumb.selected{border-color:#6366f1}' +
      '.ssdl-thumb img{width:100%;display:block;aspect-ratio:4/3;object-fit:cover}' +
      '.ssdl-badge,.ssdl-check{position:absolute;top:6px;font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(15,23,42,.75);color:#fff}' +
      '.ssdl-badge{left:6px}.ssdl-check{right:6px;width:14px;text-align:center}' +
      '.ssdl-thumb.selected .ssdl-check{background:#6366f1}';
    document.head.appendChild(style);
  }

  function buildImageUrl(info, resolution, slideNumber) {
    var r = RESOLUTIONS[resolution];
    return info.host + '/' + info.imageLocation + '/' + r.quality + '/' + info.imageTitle + '-' + slideNumber + '-' + r.width + '.jpg';
  }

  function mapWithConcurrency(items, limit, fn) {
    return new Promise(function (resolve, reject) {
      if (items.length === 0) return resolve([]);
      var results = new Array(items.length);
      var next = 0;
      var active = 0;
      var failed = false;

      function runNext() {
        if (failed) return;
        if (next >= items.length) {
          if (active === 0) resolve(results);
          return;
        }
        var idx = next++;
        active++;
        Promise.resolve(fn(items[idx], idx))
          .then(function (r) {
            results[idx] = r;
            active--;
            runNext();
          })
          .catch(function (err) {
            failed = true;
            reject(err);
          });
      }

      var starters = Math.min(limit, items.length);
      for (var i = 0; i < starters; i++) runNext();
    });
  }

  function fetchSlideBlob(imageUrl) {
    return fetch(apiBase + '/api/proxy-image?url=' + encodeURIComponent(imageUrl)).then(function (res) {
      if (!res.ok) throw new Error('Failed to download slide (HTTP ' + res.status + ')');
      return res.blob();
    });
  }

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function jpegBlobToPngBlob(blob) {
    return createImageBitmap(blob).then(function (bitmap) {
      var canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      return new Promise(function (resolve) {
        canvas.toBlob(resolve, 'image/png');
      });
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function buildZip(blobs, ext) {
    var zip = new JSZip();
    blobs.forEach(function (blob, i) {
      zip.file('slide_' + (i + 1) + '.' + ext, blob);
    });
    return zip.generateAsync({ type: 'blob' });
  }

  function buildPdf(blobs) {
    var jsPDF = window.jspdf.jsPDF;
    var doc;
    var chain = Promise.resolve();
    blobs.forEach(function (blob, i) {
      chain = chain.then(function () {
        return Promise.all([createImageBitmap(blob), blobToDataURL(blob)]).then(function (r) {
          var bitmap = r[0];
          var dataUrl = r[1];
          if (i === 0) {
            doc = new jsPDF({ unit: 'px', format: [bitmap.width, bitmap.height] });
          } else {
            doc.addPage([bitmap.width, bitmap.height]);
          }
          doc.addImage(dataUrl, 'JPEG', 0, 0, bitmap.width, bitmap.height);
        });
      });
    });
    return chain.then(function () {
      return doc.output('blob');
    });
  }

  function buildPptx(blobs) {
    var pptx = new PptxGenJS();
    var chain = Promise.resolve();
    blobs.forEach(function (blob) {
      chain = chain.then(function () {
        return blobToDataURL(blob).then(function (dataUrl) {
          var slide = pptx.addSlide();
          slide.addImage({ data: dataUrl, x: 0, y: 0, w: '100%', h: '100%' });
        });
      });
    });
    return chain.then(function () {
      return pptx.write('blob');
    });
  }

  function init() {
    injectStyles();
    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML =
      '<div class="ssdl-widget">' +
      '<form class="ssdl-form">' +
      '<input type="url" required placeholder="https://www.slideshare.net/..." />' +
      '<button type="submit">Fetch Slides</button>' +
      '</form>' +
      '<div class="ssdl-error"></div>' +
      '<div class="ssdl-results">' +
      '<div class="ssdl-toolbar">' +
      '<button type="button" class="ssdl-secondary" data-action="all">Select all</button>' +
      '<button type="button" class="ssdl-secondary" data-action="none">Select none</button>' +
      '<label>Resolution <select class="ssdl-resolution"></select></label>' +
      '<label>Format <select class="ssdl-format">' +
      '<option value="pdf">PDF</option>' +
      '<option value="pptx">PPTX</option>' +
      '<option value="jpg">ZIP (JPG)</option>' +
      '<option value="png">ZIP (PNG)</option>' +
      '</select></label>' +
      '<button type="button" class="ssdl-download" disabled>Download</button>' +
      '</div>' +
      '<div class="ssdl-progress"></div>' +
      '<div class="ssdl-grid"></div>' +
      '</div>' +
      '</div>';

    var form = container.querySelector('.ssdl-form');
    var input = form.querySelector('input');
    var fetchBtn = form.querySelector('button');
    var errorBox = container.querySelector('.ssdl-error');
    var results = container.querySelector('.ssdl-results');
    var grid = container.querySelector('.ssdl-grid');
    var resolutionSelect = container.querySelector('.ssdl-resolution');
    var formatSelect = container.querySelector('.ssdl-format');
    var downloadBtn = container.querySelector('.ssdl-download');
    var progressBox = container.querySelector('.ssdl-progress');

    Object.keys(RESOLUTIONS).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = RESOLUTIONS[key].label;
      if (key === '638') opt.selected = true;
      resolutionSelect.appendChild(opt);
    });

    var currentData = null;
    var selected = {};

    function showError(msg) {
      errorBox.textContent = msg || '';
      errorBox.classList.toggle('ssdl-visible', !!msg);
    }

    function updateDownloadLabel() {
      var count = Object.keys(selected).filter(function (k) {
        return selected[k];
      }).length;
      downloadBtn.textContent = 'Download (' + count + ')';
      downloadBtn.disabled = count === 0;
    }

    function renderGrid() {
      grid.innerHTML = '';
      currentData.slideImagesPreview.forEach(function (src, idx) {
        var thumb = document.createElement('div');
        thumb.className = 'ssdl-thumb' + (selected[idx] ? ' selected' : '');
        thumb.innerHTML =
          '<img src="' + src + '" loading="lazy" alt="Slide ' + (idx + 1) + '" />' +
          '<span class="ssdl-badge">' + (idx + 1) + '</span>' +
          '<span class="ssdl-check">' + (selected[idx] ? '✓' : '') + '</span>';
        thumb.addEventListener('click', function () {
          selected[idx] = !selected[idx];
          renderGrid();
          updateDownloadLabel();
        });
        grid.appendChild(thumb);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var url = input.value.trim();
      if (!url) return;
      showError('');
      fetchBtn.disabled = true;
      fetchBtn.textContent = 'Fetching…';
      results.classList.remove('ssdl-visible');

      fetch(apiBase + '/api/get-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideshareUrl: url }),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error(body.error || 'Failed to fetch slides.');
            return body;
          });
        })
        .then(function (body) {
          currentData = body;
          selected = {};
          body.slideImagesPreview.forEach(function (_, idx) {
            selected[idx] = true;
          });
          renderGrid();
          updateDownloadLabel();
          results.classList.add('ssdl-visible');
        })
        .catch(function (err) {
          showError(err.message);
        })
        .finally(function () {
          fetchBtn.disabled = false;
          fetchBtn.textContent = 'Fetch Slides';
        });
    });

    container.querySelector('[data-action="all"]').addEventListener('click', function () {
      currentData.slideImagesPreview.forEach(function (_, idx) {
        selected[idx] = true;
      });
      renderGrid();
      updateDownloadLabel();
    });

    container.querySelector('[data-action="none"]').addEventListener('click', function () {
      selected = {};
      renderGrid();
      updateDownloadLabel();
    });

    downloadBtn.addEventListener('click', function () {
      if (!currentData) return;
      var indices = Object.keys(selected)
        .filter(function (k) {
          return selected[k];
        })
        .map(Number)
        .sort(function (a, b) {
          return a - b;
        });
      if (indices.length === 0) {
        showError('Select at least one slide.');
        return;
      }

      showError('');
      downloadBtn.disabled = true;
      progressBox.classList.add('ssdl-visible');
      var done = 0;
      progressBox.textContent = 'Downloading slides: 0 / ' + indices.length;

      var resolution = resolutionSelect.value;
      var format = formatSelect.value;
      var urls = indices.map(function (idx) {
        return buildImageUrl(currentData.slideshowInfo, resolution, idx + 1);
      });

      mapWithConcurrency(urls, 8, function (u) {
        return fetchSlideBlob(u).then(function (blob) {
          done++;
          progressBox.textContent = 'Downloading slides: ' + done + ' / ' + indices.length;
          return blob;
        });
      })
        .then(function (blobs) {
          var stamp = Date.now();
          if (format === 'pdf') {
            return buildPdf(blobs).then(function (b) {
              downloadBlob(b, 'slides_' + stamp + '.pdf');
            });
          }
          if (format === 'pptx') {
            return buildPptx(blobs).then(function (b) {
              downloadBlob(b, 'slides_' + stamp + '.pptx');
            });
          }
          if (format === 'png') {
            return mapWithConcurrency(blobs, 4, jpegBlobToPngBlob).then(function (pngBlobs) {
              return buildZip(pngBlobs, 'png').then(function (b) {
                downloadBlob(b, 'slides_' + stamp + '.zip');
              });
            });
          }
          return buildZip(blobs, 'jpg').then(function (b) {
            downloadBlob(b, 'slides_' + stamp + '.zip');
          });
        })
        .catch(function (err) {
          showError(err.message || 'Failed to generate file.');
        })
        .finally(function () {
          downloadBtn.disabled = false;
          progressBox.classList.remove('ssdl-visible');
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
