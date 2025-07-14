'use client';

import { useState, useEffect } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { Chord, Note } from '@tonaljs/tonal';

interface ChordData {
  chord: string;
  style: StyleType;
}

type StyleType =
  | 'comping'
  | 'comping3'
  | 'comping4'
  | 'rootThenComping2'
  | 'arpeggio'
  | 'block'
  | 'stabs';

const styleOptions: { label: string; value: StyleType }[] = [
  { label: 'Comping', value: 'comping' },
  { label: 'Comping x3', value: 'comping3' },
  { label: 'Comping x4', value: 'comping4' },
  { label: 'Root + Comping x2', value: 'rootThenComping2' },
  { label: 'Arpeggio', value: 'arpeggio' },
  { label: 'Block Chord', value: 'block' },
  { label: 'Stabs', value: 'stabs' },
];

function getSafeChordNotes(chord: string): string[] {
  const chordData = Chord.get(chord);
  if (chordData.notes.length > 0) {
    return chordData.notes.map(n => n + '4');
  }
  const match = chord.match(/^([A-G][#b]?)/);
  const root = match ? match[1] : 'C';
  const third = Note.transpose(root, 'M3');
  const fifth = Note.transpose(root, 'P5');
  return [root + '4', third + '4', fifth + '4'];
}

export default function MIDIComposerApp() {
  const [bpm, setBpm] = useState(100);
  const [volume, setVolume] = useState(-6);
  const [inputString, setInputString] = useState('');
  const [progression, setProgression] = useState<ChordData[]>([]);

  useEffect(() => {
    if (!inputString.trim()) return;

    const chords = inputString
      .split('-')
      .map(c => c.trim())
      .filter(Boolean);

    const newProgression: ChordData[] = chords.map((item, i) => {
      const match = item.match(/^(.+?)\((.+?)\)$/);
      if (match) {
        return { chord: match[1], style: match[2] as StyleType };
      } else {
        return {
          chord: item,
          style: progression[i]?.style || 'comping',
        };
      }
    });
    setProgression(newProgression);
  }, [inputString]);

useEffect(() => {
  // 자동완성된 코드가 아닌 경우만 업데이트
  if (document.activeElement?.tagName !== 'INPUT') {
    const updated = progression.map(p => `${p.chord}(${p.style})`).join('-');
    if (updated !== inputString) {
      setInputString(updated);
    }
  }
}, [progression]);

  const updateChord = (i: number, field: keyof ChordData, value: string) => {
    const updated = [...progression];
    updated[i][field] = value as any;
    setProgression(updated);
  };

  const playChordPreview = async (chord: string, style: StyleType) => {
    if (!chord) return;
    await Tone.start();
    const synth = new Tone.PolySynth().toDestination();
    synth.volume.value = volume;

    const notes = getSafeChordNotes(chord);
    Tone.Transport.stop();
    Tone.Transport.cancel();

    const now = Tone.now();
    if (style === 'block') {
      synth.triggerAttackRelease(notes, '1n', now);
    } else if (style === 'arpeggio') {
      notes.forEach((n, i) =>
        synth.triggerAttackRelease(n, '8n', now + i * 0.2),
      );
    } else {
      synth.triggerAttackRelease(notes, '8n', now);
    }
  };

  const stopPlayback = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
  };

  const play = async () => {
    stopPlayback();
    await Tone.start();
    Tone.Transport.bpm.value = bpm;

    const synth = new Tone.PolySynth().toDestination();
    synth.volume.value = volume;

    let beatTime = 0;

    progression.forEach(({ chord, style }) => {
      const notes = getSafeChordNotes(chord);
      const root = [notes[0]];

      if (style === 'comping' || style === 'comping3' || style === 'comping4') {
        const times = style === 'comping3' ? 3 : style === 'comping4' ? 4 : 2;
        for (let i = 0; i < times; i++) {
          Tone.Transport.schedule(time =>
            synth.triggerAttackRelease(notes, '16n', time),
            beatTime + i * 0.25,
          );
        }
      } else if (style === 'rootThenComping2') {
        Tone.Transport.schedule(time =>
          synth.triggerAttackRelease(root, '16n', time),
          beatTime,
        );
        Tone.Transport.schedule(time =>
          synth.triggerAttackRelease(notes, '16n', time),
          beatTime + 0.5,
        );
        Tone.Transport.schedule(time =>
          synth.triggerAttackRelease(notes, '16n', time),
          beatTime + 0.75,
        );
      } else if (style === 'arpeggio') {
        notes.forEach((n, i) => {
          Tone.Transport.schedule(time =>
            synth.triggerAttackRelease(n, '16n', time),
            beatTime + i * 0.25,
          );
        });
      } else if (style === 'block') {
        Tone.Transport.schedule(time =>
          synth.triggerAttackRelease(notes, '1n', time),
          beatTime,
        );
      } else if (style === 'stabs') {
        for (let i = 0; i < 2; i++) {
          Tone.Transport.schedule(time =>
            synth.triggerAttackRelease(notes, '32n', time),
            beatTime + i * 0.5,
          );
        }
      }

      beatTime += 1;
    });

    Tone.Transport.scheduleOnce(() => {
      Tone.Transport.stop();
    }, beatTime);
    Tone.Transport.start();
  };

  const generateMidi = () => {
    const midi = new Midi();
    const track = midi.addTrack();
    let time = 0;

    progression.forEach(({ chord, style }) => {
      const notes = getSafeChordNotes(chord);
      const midiNotes = notes.map(Note.midi).filter(Boolean) as number[];

      const addNotes = (t: number, dur: number) => {
        midiNotes.forEach(note =>
          track.addNote({ midi: note, time: t, duration: dur, velocity: 0.9 }),
        );
      };

      if (style === 'comping') {
        for (let i = 0; i < 2; i++) addNotes(time + i * 0.25, 0.2);
        time += 1;
      } else if (style === 'comping3') {
        for (let i = 0; i < 3; i++) addNotes(time + i * 0.25, 0.2);
        time += 1;
      } else if (style === 'comping4') {
        for (let i = 0; i < 4; i++) addNotes(time + i * 0.25, 0.2);
        time += 1;
      } else if (style === 'rootThenComping2') {
        track.addNote({
          midi: Note.midi(notes[0])!,
          time,
          duration: 0.2,
          velocity: 0.9,
        });
        addNotes(time + 0.5, 0.2);
        addNotes(time + 0.75, 0.2);
        time += 1;
      } else if (style === 'arpeggio') {
        notes.forEach((note, i) =>
          track.addNote({
            midi: Note.midi(note)!,
            time: time + i * 0.25,
            duration: 0.2,
            velocity: 0.9,
          }),
        );
        time += 1;
      } else if (style === 'block') {
        addNotes(time, 1);
        time += 1;
      } else if (style === 'stabs') {
        addNotes(time, 0.1);
        addNotes(time + 0.5, 0.1);
        time += 1;
      }
    });

    const data = midi.toArray();
    const blob = new Blob([data], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'composition.mid';
    a.click();
  };
return (
  <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 800 }}>
    <h2>Code Chord</h2>

  <div style={{ marginBottom: '1rem' }}>
  <label>
    <strong>
      ⌨️
      <span style={{ color: '#888', fontWeight: 'normal' }}>
        (Cm7 - F7 - Bbmaj7 - Gm7)
      </span>
    </strong>
  </label>
  <input
    type="text"
    value={inputString}
    onChange={e => setInputString(e.target.value)}
    style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
  />
</div>


    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
      <label><strong>BPM:</strong></label>
      <input
        type="number"
        value={bpm}
        onChange={e => setBpm(Number(e.target.value))}
      />
      <label><strong>🔊</strong></label>
      <input
        type="range"
        min="-24"
        max="0"
        value={volume}
        onChange={e => setVolume(Number(e.target.value))}
      />
      <button onClick={play}>▶ PLAY</button>
      <button onClick={stopPlayback}>⏹ STOP</button>
      <button onClick={generateMidi}>💾 MIDI</button>
      <a
        href="https://github.com/Hwanji2/CodeCompose"
        target="_blank"
        rel="noopener noreferrer"
      >
        🐈‍⬛
      </a>
    </div>

    {progression.map((p, i) => (
      <div key={i} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <input
          value={p.chord}
          onChange={e => updateChord(i, 'chord', e.target.value)}
          style={{ width: '100px' }}
        />
        <select
          value={p.style}
          onChange={e => updateChord(i, 'style', e.target.value)}
        >
          {styleOptions.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button onClick={() => playChordPreview(p.chord, p.style)}>🎧 미리듣기</button>
      </div>
    ))}
  </div>
);

}
