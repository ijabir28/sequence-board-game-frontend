import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import { clampCrop, cropSquare, initialCrop, MAX_ZOOM, panCrop, type Crop } from './avatarImage';
import styles from './AvatarCropDialog.module.css';

interface AvatarCropDialogProps {
  /** The picture to crop; the dialog is open while there is one. */
  file: File | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (crop: Crop) => void;
  /** The browser couldn't show the picture; `message` is written for players. */
  onError: (message: string) => void;
}

const KEY_STEP = 12;
const ZOOM_STEP = 0.25;

/**
 * Crops a chosen picture before it becomes the avatar: drag (or use the arrow keys) to move it, and the slider, the
 * mouse wheel or a pinch to zoom. The circle shows what other players will see.
 */
export function AvatarCropDialog({ file, busy, onCancel, onSave, onError }: AvatarCropDialogProps) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const [picture, setPicture] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  // Pointers on the frame: one drags, two pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    setPicture(null);
    setCrop(null);
    pointers.current.clear();
  }, [file]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setFrame(element.clientWidth));
    observer.observe(element);
    setFrame(element.clientWidth);
    return () => observer.disconnect();
  }, [url]);

  const update = (next: (crop: Crop) => Crop) => {
    if (!picture) return;
    setCrop((was) => (was ? clampCrop(next(was), picture.width, picture.height) : was));
  };
  const zoomTo = (zoom: number) => update((was) => ({ ...was, zoom }));
  const pan = (dx: number, dy: number) => {
    if (!picture || !frame) return;
    setCrop((was) => (was ? panCrop(was, dx, dy, frame, picture.width, picture.height) : was));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const was = pointers.current.get(event.pointerId);
    if (!was) return;
    const now = { x: event.clientX, y: event.clientY };
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId).map(([, point]) => point);
    if (others.length === 1) {
      // Pinch: zoom by how much the two fingers spread or close.
      const other = others[0];
      const before = Math.hypot(was.x - other.x, was.y - other.y);
      const after = Math.hypot(now.x - other.x, now.y - other.y);
      if (before > 0) update((crop) => ({ ...crop, zoom: crop.zoom * (after / before) }));
    } else if (others.length === 0) {
      pan(now.x - was.x, now.y - was.y);
    }
    pointers.current.set(event.pointerId, now);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    update((crop) => ({ ...crop, zoom: crop.zoom * Math.exp(-event.deltaY / 500) }));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    if (event.key in moves) {
      event.preventDefault();
      pan(...moves[event.key]);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      update((crop) => ({ ...crop, zoom: crop.zoom + ZOOM_STEP }));
    } else if (event.key === '-') {
      event.preventDefault();
      update((crop) => ({ ...crop, zoom: crop.zoom - ZOOM_STEP }));
    }
  };

  // Where the picture sits in the frame: the crop's square fills it exactly.
  let placement: CSSProperties | undefined;
  if (picture && crop && frame) {
    const [x, y, side] = cropSquare(crop, picture.width, picture.height);
    const scale = frame / side;
    placement = { width: picture.width * scale, height: picture.height * scale, transform: `translate(${-x * scale}px, ${-y * scale}px)` };
  }

  return (
    <Dialog
      open={file !== null}
      title="Crop your picture"
      onClose={() => !busy && onCancel()}
      actions={
        <>
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} disabled={!crop} onClick={() => crop && onSave(crop)} tip="Save this crop as your picture">
            Save picture
          </Button>
        </>
      }
    >
      <p className={styles.help}>Drag to move the picture, zoom to crop it. Other players see what's inside the circle.</p>
      <div
        ref={frameRef}
        className={styles.frame}
        tabIndex={0}
        role="group"
        aria-label="Picture position. Use the arrow keys to move it, plus and minus to zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        {url && (
          <img
            key={url}
            src={url}
            alt=""
            draggable={false}
            className={styles.picture}
            style={placement ?? { visibility: 'hidden' }}
            onLoad={(event) => {
              const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
              setPicture({ width, height });
              setCrop(initialCrop(width, height));
            }}
            onError={() => onError("That file isn't a picture this browser can open. Try a PNG or JPEG.")}
          />
        )}
        <span className={styles.ring} aria-hidden="true" />
      </div>
      <div className={styles.zoom}>
        <button type="button" className={styles.zoomButton} onClick={() => zoomTo((crop?.zoom ?? 1) - ZOOM_STEP)} disabled={!crop || crop.zoom <= 1} aria-label="Zoom out" {...tipProps('Zoom out')}>
          <Icon name="minus" size={18} />
        </button>
        <input
          type="range"
          className={styles.slider}
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={crop?.zoom ?? 1}
          disabled={!crop}
          onChange={(event) => zoomTo(Number(event.target.value))}
          aria-label="Zoom"
        />
        <button type="button" className={styles.zoomButton} onClick={() => zoomTo((crop?.zoom ?? 1) + ZOOM_STEP)} disabled={!crop || crop.zoom >= MAX_ZOOM} aria-label="Zoom in" {...tipProps('Zoom in')}>
          <Icon name="plus" size={18} />
        </button>
        <button
          type="button"
          className={styles.zoomButton}
          onClick={() => picture && setCrop(initialCrop(picture.width, picture.height))}
          disabled={!crop}
          aria-label="Reset"
          {...tipProps('Back to the whole picture, centred')}
        >
          <Icon name="refresh" size={18} />
        </button>
      </div>
    </Dialog>
  );
}
