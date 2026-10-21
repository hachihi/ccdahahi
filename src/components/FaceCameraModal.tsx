import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle } from 'lucide-react';
import { shrinkImage } from '../services/dahahiService';

interface FaceCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Data: string) => void;
  employeeName?: string;
}

export const FaceCameraModal: React.FC<FaceCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  employeeName
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Start webcam
  const startCamera = async () => {
    setErrorMsg(null);
    setCapturedPhoto(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: 'user'
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setErrorMsg(
        'Không thể mở Camera. Vui lòng cấp quyền truy cập webcam trên trình duyệt hoặc chọn tải ảnh từ máy tính.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedPhoto(null);
      setErrorMsg(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleSnap = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crop center square
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(rawDataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const handleConfirm = async () => {
    if (!capturedPhoto) return;
    setIsProcessing(true);
    try {
      // Convert dataUrl to blob and shrink
      const res = await fetch(capturedPhoto);
      const blob = await res.blob();
      const optimizedBase64 = await shrinkImage(blob);
      onCapture(optimizedBase64);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xử lý ảnh');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Chụp ảnh khuôn mặt
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {employeeName ? `Nhân viên: ${employeeName}` : 'Chụp trực tiếp từ Webcam máy tính/điện thoại'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport */}
        <div className="p-5 flex flex-col items-center justify-center">
          {errorMsg ? (
            <div className="w-full p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3 my-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Không thể truy cập Camera</p>
                <p className="mt-1 text-xs">{errorMsg}</p>
                <button
                  onClick={startCamera}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition"
                >
                  Thử lại
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-72 h-72 rounded-2xl overflow-hidden bg-slate-950 shadow-inner flex items-center justify-center border-2 border-slate-200 dark:border-slate-800">
              {/* Video Feed */}
              {!capturedPhoto && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  {/* Face Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-48 h-60 border-2 border-dashed border-emerald-400/80 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] animate-pulse" />
                    <span className="absolute bottom-3 text-[11px] font-medium text-emerald-300 bg-slate-950/80 px-2 py-0.5 rounded-full">
                      Căn chỉnh khuôn mặt vào khung
                    </span>
                  </div>
                </>
              )}

              {/* Photo Preview */}
              {capturedPhoto && (
                <img
                  src={capturedPhoto}
                  alt="Khuôn mặt đã chụp"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Hidden Canvas */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Hint */}
          <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center space-y-1">
            <p>• Nhìn thẳng vào camera, cởi khẩu trang & kính râm.</p>
            <p>• Ảnh sẽ được tự động tối ưu hóa chuẩn nén thiết bị Dahahi (&le;480px).</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            Hủy
          </button>

          <div className="flex items-center gap-2">
            {!capturedPhoto ? (
              <button
                disabled={!isCameraActive}
                onClick={handleSnap}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Camera className="w-4 h-4" />
                Chụp ảnh
              </button>
            ) : (
              <>
                <button
                  onClick={handleRetake}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Chụp lại
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleConfirm}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  <Check className="w-4 h-4" />
                  {isProcessing ? 'Đang nén...' : 'Sử dụng ảnh này'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
