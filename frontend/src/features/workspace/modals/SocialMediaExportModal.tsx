import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DialogHeader from '../../../components/DialogHeader';
import { Photo } from '../types';
import { SOCIAL_TEMPLATES, calculateCanvasDimensions, renderToCanvas } from '../socialCanvas';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    photo: Photo | null;
};

export const SocialMediaExportModal = ({ isOpen, onClose, photo }: Props) => {
    const [templateId, setTemplateId] = useState(SOCIAL_TEMPLATES[0].id);
    const [bgColor, setBgColor] = useState('#ffffff');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);

    // Reset state when photo changes or modal opens
    useEffect(() => {
        if (isOpen && photo) {
            setTemplateId(SOCIAL_TEMPLATES[0].id); // Default to IG Portrait
            // Load image
            const img = new Image();
            img.crossOrigin = 'anonymous';
            // Use full resolution src if implicit, or assume thumbSrc is placeholder.
            // In a real app we'd fetch the high-res or use the Worker's source.
            // For now, use whatever URL we have.
            // Note: If photo.src is missing, we might need to fetch it.
            // Assuming photo object has a valid src for this context.
            // If strictly local (e.g. file://), it works.
            // If blob, works.
            const sourceUrl = (photo as any).src || photo.thumbSrc || '';
            if (sourceUrl) {
                img.src = sourceUrl;
                img.onload = () => {
                    createImageBitmap(img).then(setImageBitmap).catch(console.error);
                };
            }
        } else {
            setImageBitmap(null);
        }
    }, [isOpen, photo]);

    // Draw to canvas
    useEffect(() => {
        if (canvasRef.current && imageBitmap) {
            const template = SOCIAL_TEMPLATES.find(t => t.id === templateId) || SOCIAL_TEMPLATES[0];
            const targetDims = calculateCanvasDimensions(
                { width: imageBitmap.width, height: imageBitmap.height },
                template.ratio
            );

            // We render to the canvas at full resolution?
            // To prevent UI lag with huge images, we might want to scale down for Preview?
            // But for "Export", we want full resolution.
            // Let's render full resolution to the canvas, but style the canvas to fit via CSS.
            renderToCanvas(imageBitmap, canvasRef.current, targetDims, bgColor);
        }
    }, [imageBitmap, templateId, bgColor]);

    const handleExport = () => {
        if (canvasRef.current && photo) {
            // Convert to blob and download
            canvasRef.current.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const template = SOCIAL_TEMPLATES.find(t => t.id === templateId);
                    a.href = url;
                    a.download = `${photo.name || 'export'}_${template?.label.replace(/\s+/g, '_')}.jpeg`;
                    a.click();
                    URL.revokeObjectURL(url);
                    // Optional: Close after export?
                    // onClose();
                }
            }, 'image/jpeg', 0.95);
        }
    };

    if (!isOpen || !photo) return null;

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="flex w-[min(1000px,100%)] h-[80vh] overflow-hidden rounded-[28px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] shadow-2xl flex-col">
                <DialogHeader
                    title="Social Media Export"
                    subtitle={`Preparing: ${photo.name}`}
                    onClose={onClose}
                    closeLabel="Close"
                />

                <div className="flex flex-1 min-h-0 divide-x divide-[var(--border,#E1D3B9)] overflow-hidden">
                    {/* Left: Preview */}
                    <div className="flex-1 bg-[var(--surface-subtle,#FBF7EF)] p-6 flex items-center justify-center overflow-hidden">
                        <canvas
                            ref={canvasRef}
                            className="max-w-full max-h-full object-contain shadow-sm border border-[var(--border,#E1D3B9)]"
                        />
                    </div>

                    {/* Right: Controls */}
                    <div className="w-[320px] bg-[var(--surface,#FFFFFF)] flex flex-col p-6 gap-6 overflow-y-auto">

                        {/* Templates */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
                                Template
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {SOCIAL_TEMPLATES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTemplateId(t.id)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-[14px] border transition-all ${templateId === t.id
                                                ? 'border-[var(--text,#1F1E1B)] bg-[var(--sand-50,#F3EBDD)] ring-1 ring-[var(--text,#1F1E1B)]'
                                                : 'border-[var(--border,#E1D3B9)] bg-white hover:border-[var(--text-muted,#6B645B)]'
                                            }`}
                                    >
                                        <div className="text-sm font-semibold">{t.label}</div>
                                        <div className="text-xs text-[var(--text-muted,#6B645B)] mt-1">{t.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Background Color */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
                                Background
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={bgColor}
                                    onChange={(e) => setBgColor(e.target.value)}
                                    className="h-10 w-10 rounded-full border-0 p-0 overflow-hidden cursor-pointer"
                                />
                                <span className="text-sm font-medium text-[var(--text,#1F1E1B)] uppercase">{bgColor}</span>
                            </div>
                            <div className="flex gap-2">
                                {['#ffffff', '#000000', '#f3ebdd', '#1f1e1b'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setBgColor(c)}
                                        className="w-8 h-8 rounded-full border border-[var(--border,#E1D3B9)]"
                                        style={{ backgroundColor: c }}
                                        title={c}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            className="w-full h-12 rounded-full bg-[var(--text,#1F1E1B)] text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                            <span>Download Image</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
