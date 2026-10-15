import { useEffect, useRef, useState } from 'react';

export default function useSignatureCanvas(resetKey) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const clearSignature = () => {
    drawing.current = false;
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };
  useEffect(() => { clearSignature(); }, [resetKey]);
  const point = event => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    const input = event.touches?.[0] || event;
    return { x: (input.clientX - bounds.left) * canvas.width / bounds.width, y: (input.clientY - bounds.top) * canvas.height / bounds.height };
  };
  const handleStartDraw = event => {
    const position = point(event); const ctx = canvasRef.current?.getContext('2d');
    if (!position || !ctx) return;
    ctx.beginPath(); ctx.moveTo(position.x, position.y); drawing.current = true;
  };
  const handleDraw = event => {
    if (!drawing.current) return;
    const position = point(event); const ctx = canvasRef.current?.getContext('2d');
    if (!position || !ctx) return;
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a';
    ctx.lineTo(position.x, position.y); ctx.stroke(); setHasSignature(true);
  };
  const handleStopDraw = () => { drawing.current = false; };
  return { canvasRef, hasSignature, clearSignature, handleStartDraw, handleDraw, handleStopDraw };
}
