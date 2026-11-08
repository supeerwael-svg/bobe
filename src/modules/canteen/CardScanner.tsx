import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner, LensFacing } from '@capacitor-mlkit/barcode-scanning';
import { Flashlight, FlashlightOff, PencilLine, SwitchCamera, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

const DUPLICATE_WINDOW_MS = 2000;
const NATIVE_FORMATS = [
  BarcodeFormat.Code128,
  BarcodeFormat.Code39,
  BarcodeFormat.Ean13,
  BarcodeFormat.Itf,
  BarcodeFormat.QrCode,
  BarcodeFormat.DataMatrix,
  BarcodeFormat.Pdf417,
];
const WEB_FORMATS = ['code_128', 'code_39', 'ean_13', 'itf', 'qr_code', 'data_matrix', 'pdf417'];

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

type ScannerStatus = 'checking' | 'needPermission' | 'running' | 'denied' | 'unsupported';

interface CardScannerProps {
  paused: boolean;
  onDetect: (text: string) => void;
  onManual: () => void;
  onClose: () => void;
}

export function CardScanner({ paused, onDetect, onManual, onClose }: CardScannerProps) {
  const { t } = useTranslation();
  const isNative = Capacitor.isNativePlatform();
  const [status, setStatus] = useState<ScannerStatus>('checking');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [permissionVersion, setPermissionVersion] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const pausedRef = useRef(paused);
  const onDetectRef = useRef(onDetect);
  const lastRef = useRef<{ text: string; at: number } | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
    onDetectRef.current = onDetect;
  }, [paused, onDetect]);

  const emit = (text: string) => {
    const value = text.trim();
    if (!value || pausedRef.current) return;
    const now = Date.now();
    const last = lastRef.current;
    if (last && last.text === value && now - last.at < DUPLICATE_WINDOW_MS) return;
    lastRef.current = { text: value, at: now };
    onDetectRef.current(value);
  };

  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    let listener: { remove: () => Promise<void> } | null = null;
    document.documentElement.classList.add('barcode-scanner-active');

    const start = async () => {
      listener = await BarcodeScanner.addListener('barcodesScanned', (event) => {
        const value = event.barcodes[0]?.rawValue;
        if (value) emit(value);
      });
      await BarcodeScanner.startScan({
        formats: NATIVE_FORMATS,
        lensFacing: facing === 'user' ? LensFacing.Front : LensFacing.Back,
      });
      const torch = await BarcodeScanner.isTorchAvailable();
      if (!cancelled) setTorchAvailable(torch.available);
      if (!cancelled) setStatus('running');
    };

    (async () => {
      const current = await BarcodeScanner.checkPermissions();
      if (current.camera === 'granted') {
        await start();
      } else if (!cancelled) {
        setStatus('needPermission');
      }
    })().catch(() => {
      if (!cancelled) setStatus('denied');
    });

    return () => {
      cancelled = true;
      document.documentElement.classList.remove('barcode-scanner-active');
      void listener?.remove();
      void BarcodeScanner.stopScan();
    };
    // Restart the native scanner only when the camera direction or permission changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, facing, permissionVersion]);

  const requestNativePermission = async () => {
    const result = await BarcodeScanner.requestPermissions();
    if (result.camera === 'granted') {
      setPermissionVersion((value) => value + 1);
    } else {
      setStatus('denied');
    }
  };

  useEffect(() => {
    if (isNative) return;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    let cancelled = false;
    let timer: number | null = null;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      } catch {
        if (!cancelled) setStatus('denied');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;
      const capabilities = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorchAvailable(Boolean(capabilities.torch));
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      const detector = new Detector({ formats: WEB_FORMATS });
      setStatus('running');
      timer = window.setInterval(() => {
        const source = videoRef.current;
        if (!source || source.readyState < 2) return;
        detector
          .detect(source)
          .then((codes) => {
            const value = codes[0]?.rawValue;
            if (value) emit(value);
          })
          .catch(() => undefined);
      }, 200);
    })();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      stream?.getTracks().forEach((item) => item.stop());
      trackRef.current = null;
    };
    // The browser camera restarts only when the camera direction changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, facing]);

  const toggleTorch = async () => {
    const next = !torchOn;
    if (isNative) {
      await BarcodeScanner.toggleTorch();
    } else {
      const track = trackRef.current;
      if (!track) return;
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] }).catch(() => undefined);
    }
    setTorchOn(next);
  };

  const switchCamera = () => {
    setTorchOn(false);
    setFacing((value) => (value === 'environment' ? 'user' : 'environment'));
  };

  const overlayClass = isNative ? 'bg-transparent' : 'bg-neutral-950';

  return (
    <div className={`fixed inset-0 z-50 flex flex-col text-white ${overlayClass}`}>
      {!isNative ? (
        <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : null}

      <div className="relative z-10 flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('canteen.scanner.close')}
          className="flex size-14 items-center justify-center rounded-full bg-black/50 transition active:scale-95"
        >
          <X className="size-7" aria-hidden />
        </button>
        <div className="flex gap-3">
          {torchAvailable ? (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torchOn ? t('canteen.scanner.torchOff') : t('canteen.scanner.torchOn')}
              aria-pressed={torchOn}
              className="flex size-14 items-center justify-center rounded-full bg-black/50 transition active:scale-95"
            >
              {torchOn ? <FlashlightOff className="size-7" aria-hidden /> : <Flashlight className="size-7" aria-hidden />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={switchCamera}
            aria-label={t('canteen.scanner.switchCamera')}
            className="flex size-14 items-center justify-center rounded-full bg-black/50 transition active:scale-95"
          >
            <SwitchCamera className="size-7" aria-hidden />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {status === 'running' ? (
          <>
            <div className="aspect-[3/2] w-full max-w-sm rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            <p className="rounded-full bg-black/60 px-4 py-2 text-center text-base">{t('canteen.scanner.hint')}</p>
          </>
        ) : null}
        {status === 'checking' ? <p className="text-lg">{t('canteen.scanner.starting')}</p> : null}
        {status === 'needPermission' ? (
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 text-neutral-900">
            <h2 className="text-lg font-bold">{t('canteen.scanner.permissionTitle')}</h2>
            <p className="text-base text-neutral-700">{t('canteen.scanner.permissionBody')}</p>
            <Button fullWidth onClick={requestNativePermission}>
              {t('canteen.scanner.allowCamera')}
            </Button>
          </div>
        ) : null}
        {status === 'denied' ? (
          <p className="max-w-sm rounded-2xl bg-danger-700 p-4 text-center text-base font-medium">{t('canteen.scanner.permissionDenied')}</p>
        ) : null}
        {status === 'unsupported' ? (
          <p className="max-w-sm rounded-2xl bg-neutral-800 p-4 text-center text-base">{t('canteen.scanner.unsupported')}</p>
        ) : null}
      </div>

      <div className="relative z-10 p-4">
        <button
          type="button"
          onClick={onManual}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-base font-bold text-neutral-900 transition active:scale-[0.98]"
        >
          <PencilLine className="size-5" aria-hidden />
          {t('canteen.scanner.manual')}
        </button>
      </div>
    </div>
  );
}
