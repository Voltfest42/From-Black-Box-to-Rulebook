import { useEffect, useMemo, useState } from 'react';
import type { Trainer } from '../core/models/mlp';

export interface TrainingRun {
  trainer: Trainer;
  epoch: number;
  losses: readonly number[];
  playing: boolean;
  done: boolean;
  play: () => void;
  pause: () => void;
  /** Train to the end without animating. */
  finish: () => void;
}

/**
 * Trains a network a few epochs per animation frame, so the reader can watch
 * it learn. A new `key` (another dataset, another seed) starts a fresh run.
 */
export function useTraining(make: () => Trainer, key: string, totalEpochs: number, epochsPerFrame = 3): TrainingRun {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` names everything `make` depends on
  const trainer = useMemo(() => make(), [key]);
  const [run, setRun] = useState({ key, epoch: 0, losses: [] as number[], playing: false });
  const current = run.key === key ? run : { key, epoch: 0, losses: [] as number[], playing: false };

  useEffect(() => {
    if (!current.playing) return;
    let frame = requestAnimationFrame(function tick() {
      const added: number[] = [];
      for (let i = 0; i < epochsPerFrame && trainer.epochs < totalEpochs; i++) added.push(trainer.epoch());
      setRun((prev) => {
        if (prev.key !== key) return prev;
        const epoch = trainer.epochs;
        return { key, epoch, losses: [...prev.losses, ...added], playing: epoch < totalEpochs };
      });
      if (trainer.epochs < totalEpochs) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [current.playing, trainer, key, totalEpochs, epochsPerFrame]);

  return {
    trainer,
    epoch: current.epoch,
    losses: current.losses,
    playing: current.playing,
    done: current.epoch >= totalEpochs,
    play: () => setRun({ ...current, playing: current.epoch < totalEpochs }),
    pause: () => setRun({ ...current, playing: false }),
    finish: () => {
      const added: number[] = [];
      while (trainer.epochs < totalEpochs) added.push(trainer.epoch());
      setRun({ key, epoch: trainer.epochs, losses: [...current.losses, ...added], playing: false });
    },
  };
}
