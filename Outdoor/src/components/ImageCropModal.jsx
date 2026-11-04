// src/components/ImageCropModal.jsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const ImageCropModal = ({ isOpen, imageSrc, onClose, onCropComplete }) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  const CROP_SIZE = 280;
  const OUTPUT_SIZE = 400;

  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    setImgLoaded(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  useEffect(() => {
    if (!imgLoaded || !imageRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Hitung skala dasar agar gambar menutupi kotak crop (object-cover)
    const baseScale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
    const finalScale = baseScale * zoom;

    const drawWidth = img.width * finalScale;
    const drawHeight = img.height * finalScale;

    const centerX = (CROP_SIZE - drawWidth) / 2 + offset.x;
    const centerY = (CROP_SIZE - drawHeight) / 2 + offset.y;

    ctx.save();
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);
    ctx.drawImage(img, centerX, centerY, drawWidth, drawHeight);

    // Garis bantu grid 3x3 tipis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CROP_SIZE / 3, 0);
    ctx.lineTo(CROP_SIZE / 3, CROP_SIZE);
    ctx.moveTo((CROP_SIZE * 2) / 3, 0);
    ctx.lineTo((CROP_SIZE * 2) / 3, CROP_SIZE);
    ctx.moveTo(0, CROP_SIZE / 3);
    ctx.lineTo(CROP_SIZE, CROP_SIZE / 3);
    ctx.moveTo(0, (CROP_SIZE * 2) / 3);
    ctx.lineTo(CROP_SIZE, (CROP_SIZE * 2) / 3);
    ctx.stroke();
    ctx.restore();
  }, [imgLoaded, zoom, offset]);

  if (!isOpen || !imageSrc) return null;

  const handlePointerDown = (clientX, clientY) => {
    setIsDragging(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handlePointerMove = (clientX, clientY) => {
    if (!isDragging) return;
    setOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleSaveCrop = () => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUTPUT_SIZE;
    outCanvas.height = OUTPUT_SIZE;
    const outCtx = outCanvas.getContext('2d');

    const ratio = OUTPUT_SIZE / CROP_SIZE;
    const baseScale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
    const finalScale = baseScale * zoom * ratio;

    const drawWidth = img.width * finalScale;
    const drawHeight = img.height * finalScale;
    const centerX = ((CROP_SIZE - img.width * baseScale * zoom) / 2 + offset.x) * ratio;
    const centerY = ((CROP_SIZE - img.height * baseScale * zoom) / 2 + offset.y) * ratio;

    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    outCtx.drawImage(img, centerX, centerY, drawWidth, drawHeight);

    const croppedDataUrl = outCanvas.toDataURL('image/jpeg', 0.88);
    onCropComplete(croppedDataUrl);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <i className="fa-solid fa-crop-simple text-brand-600"></i> Sesuaikan & Crop Foto
            </h3>
            <p className="text-xs text-gray-500">Geser foto untuk mengatur posisi dan gunakan slider untuk memperbesar.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Area Kanvas Crop */}
        <div className="my-5 flex flex-col items-center">
          <div
            className="relative rounded-2xl overflow-hidden border-2 border-brand-600 shadow-inner cursor-move select-none bg-gray-100"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={(e) => {
              if (e.touches[0]) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchMove={(e) => {
              if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchEnd={handlePointerUp}
          >
            <canvas ref={canvasRef} width={CROP_SIZE} height={CROP_SIZE} className="block" />
            <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
              <span className="bg-black/60 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                <i className="fa-solid fa-arrows-up-down-left-right mr-1"></i> Geser untuk atur posisi
              </span>
            </div>
          </div>

          {/* Kontrol Zoom & Reset */}
          <div className="w-full mt-4 space-y-2 px-2">
            <div className="flex items-center justify-between text-xs text-gray-600 font-bold">
              <span><i className="fa-solid fa-magnifying-glass-plus mr-1 text-brand-600"></i> Perbesar (Zoom)</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-green-700 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                className="text-xs font-bold text-gray-500 hover:text-brand-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveCrop}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-check"></i> Terapkan Crop
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
