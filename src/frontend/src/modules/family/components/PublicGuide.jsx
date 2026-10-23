import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { Robot } from '../../assistant/robots';
import '../../assistant/assistant.css';

const seenKey = (token) => `family_guide_${token}`;
const posKey = (token) => `family_guide_pos_${token}`;
const SIZE = 64;
const MARGIN = 10;
const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

function readPos(token) {
  try {
    const raw = JSON.parse(localStorage.getItem(posKey(token)) || 'null');
    return raw && Number.isFinite(raw.x) && Number.isFinite(raw.y) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * The helper robot of a public link: greets the visitor once and explains
 * what this link allows — looking around, proposing changes or editing —
 * with a hint about the person who is open right now.
 */
export default function PublicGuide({ token, access, person, canPropose }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [blink, setBlink] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Position: bottom right by default; dragged spots are kept per link (as viewport fractions).
  const place = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const saved = readPos(token);
    const maxX = vw - SIZE - MARGIN;
    const maxY = vh - SIZE - MARGIN;
    if (!saved) return { x: maxX - 6, y: clamp(vh - SIZE - (vw < 576 ? 84 : 24), MARGIN, maxY) };
    return { x: clamp(saved.x * vw - SIZE / 2, MARGIN, maxX), y: clamp(saved.y * vh - SIZE / 2, MARGIN, maxY) };
  }, [token]);
  const [pos, setPos] = useState(place);
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    const update = () => setPos(place());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [place]);

  // Eyes follow the pointer.
  const botRef = useRef(null);
  useEffect(() => {
    let frame = 0;
    const onMove = (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = botRef.current?.getBoundingClientRect();
        if (!box) return;
        setLook({ x: clamp((event.clientX - box.left - box.width / 2) / 320, -1, 1), y: clamp((event.clientY - box.top - box.height / 2) / 320, -1, 1) });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // Dragging; a short move is a tap.
  const drag = useRef(null);
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    drag.current = { sx: event.clientX, sy: event.clientY, x: pos.x, y: pos.y, moved: false, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    const st = drag.current;
    if (!st || st.id !== event.pointerId) return;
    const dx = event.clientX - st.sx;
    const dy = event.clientY - st.sy;
    if (!st.moved && Math.hypot(dx, dy) < 6) return;
    if (!st.moved) {
      st.moved = true;
      setDragging(true);
    }
    setPos({ x: clamp(st.x + dx, MARGIN, window.innerWidth - SIZE - MARGIN), y: clamp(st.y + dy, MARGIN, window.innerHeight - SIZE - MARGIN) });
  };
  const onPointerUp = (event) => {
    const st = drag.current;
    if (!st || st.id !== event.pointerId) return;
    drag.current = null;
    if (st.moved) {
      setDragging(false);
      const cur = posRef.current;
      try {
        localStorage.setItem(posKey(token), JSON.stringify({ x: (cur.x + SIZE / 2) / window.innerWidth, y: (cur.y + SIZE / 2) / window.innerHeight }));
      } catch {
        /* private mode */
      }
      return;
    }
    if (open) close();
    else {
      setStep(0);
      setOpen(true);
    }
  };

  useEffect(() => {
    let seen = false;
    try {
      seen = Boolean(localStorage.getItem(seenKey(token)));
    } catch {
      seen = false;
    }
    if (!seen) {
      const timer = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [token]);

  useEffect(() => {
    let off = 0;
    const id = setInterval(() => {
      setBlink(true);
      off = setTimeout(() => setBlink(false), 160);
    }, 4200);
    return () => {
      clearInterval(id);
      clearTimeout(off);
    };
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(seenKey(token), '1');
    } catch {
      /* private mode */
    }
  };

  // Tips: the common ones, then those of this access level.
  const tips = ['move', 'person', 'views'];
  if (access === 'suggest') tips.push('suggest', 'photo', 'relative');
  if (access === 'edit') tips.push('edit', 'photo', 'relative');
  const current = tips[Math.min(step, tips.length - 1)];
  const contextual = person && canPropose ? t('family.guide.onPerson', { name: person }) : person ? t('family.guide.onPersonView', { name: person }) : null;

  return (
    <div
      className={`fam-guide${open ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}${pos.y > window.innerHeight / 2 ? ' is-low' : ' is-high'}${pos.x > window.innerWidth / 2 ? ' is-right' : ' is-left'}`}
      style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
    >
      {open && (
        <div className="fam-guide__bubble" role="dialog" aria-label={t('family.guide.title')}>
          <button type="button" className="fam-guide__close" onClick={close} aria-label={t('common.close')}>
            <CloseOutlined />
          </button>
          {step === 0 && <div className="fam-guide__hello">{t(`family.guide.hello.${access}`)}</div>}
          {contextual && step > 0 && <div className="fam-guide__context">{contextual}</div>}
          <div className="fam-guide__tip">
            <span className="fam-guide__n">
              {Math.min(step, tips.length - 1) + 1}/{tips.length}
            </span>
            <b>{t(`family.guide.tip.${current}.title`)}</b>
            <p>{t(`family.guide.tip.${current}.text`)}</p>
          </div>
          <div className="fam-guide__nav">
            {step > 0 && (
              <Button size="small" onClick={() => setStep((s) => s - 1)}>
                {t('family.guide.back')}
              </Button>
            )}
            {step < tips.length - 1 ? (
              <Button size="small" type="primary" onClick={() => setStep((s) => s + 1)}>
                {t('family.guide.next')}
              </Button>
            ) : (
              <Button size="small" type="primary" onClick={close}>
                {t('family.guide.done')}
              </Button>
            )}
          </div>
        </div>
      )}
      <button
        ref={botRef}
        type="button"
        className="fam-guide__bot"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(event) => {
          if (drag.current?.id !== event.pointerId) return;
          drag.current = null;
          setDragging(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) close();
            else {
              setStep(0);
              setOpen(true);
            }
          }
        }}
        aria-label={t('family.guide.title')}
        title={t('family.guide.title')}
      >
        <Robot kind="pixel" mood={dragging ? 'surprised' : open ? 'happy' : 'idle'} blink={blink} look={look} size={SIZE} />
      </button>
    </div>
  );
}
