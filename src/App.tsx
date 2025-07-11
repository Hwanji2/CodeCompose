import { useState } from 'react';
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import { Chord, Note } from '@tonaljs/tonal';

interface ChordData {
  chord: string;
  style: 'comping' | 'arpeggio';
}

function App() {
  const [bpm, setBpm] = useState(100);
  const [progression, setProgression] = useState<ChordData[]>([
    { chord: 'Cmaj7', style: 'comping' },
    { chord: 'Am7', style: 'arpeggio' },
  ]);

  const addChord = () => {
    setProgression([...progression, { chord: '', style: 'comping' }]);
  };

  const updateChord = (index: number, field: keyof ChordData, value: string) => {
    const updated = [...progression];
    updated[index][field] = value as any;
    setProgression(updated);
  };

  const generateMidi = () => {
    const midi = new Midi();
    const track = midi.addTrack();
    let time = 0;

    progression.forEach(({ chord, style }) => {
      const rawNotes = Chord.get(chord).notes.map(n => Note.midi(n + '4'));
      const chordNotes = rawNotes.filter((n): n is number => n !== null);

      if (style === 'comping') {
        for (let i = 0; i < 4; i++) {
          chordNotes.forEach(note => {
            track.addNote({ midi: note, time: time + i * 0.25, duration: 0.2, velocity: 0.8 });
          });
        }
      } else {
        chordNotes.forEach((note, i) => {
          track.addNote({ midi: note, time: time + i * 0.25, duration: 0.25, velocity: 0.8 });
        });
      }

      time += 1;
    });

    const data = midi.toArray();
    const blob = new Blob([data], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'composition.mid';
    a.click();
  };

  const play = async () => {
    const synth = new Tone.PolySynth().toDestination();

    await Tone.start();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = bpm;

    let beatTime = 0;

    progression.forEach(({ chord, style }) => {
      const notes = Chord.get(chord).notes.map(n => n + '4');

      if (style === 'comping') {
        for (let i = 0; i < 4; i++) {
          Tone.Transport.schedule(time => {
            synth.triggerAttackRelease(notes, '16n', time);
          }, beatTime + i * 0.25);
        }
      } else {
        notes.forEach((note, i) => {
          Tone.Transport.schedule(time => {
            synth.triggerAttackRelease(note, '16n', time);
          }, beatTime + i * 0.25);
        });
      }

      beatTime += 1;
    });

    Tone.Transport.start();
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h2>MIDI 코드 컴포저 🎼</h2>

      <div style={{ marginBottom: '1rem' }}>
        <label><strong>BPM:</strong> </label>
        <input
          type="number"
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
        />
      </div>

      {progression.map((p, i) => (
        <div key={i} style={{ marginBottom: '0.5rem' }}>
          <input
            value={p.chord}
            placeholder="ex: Cmaj7"
            onChange={(e) => updateChord(i, 'chord', e.target.value)}
            style={{ marginRight: '0.5rem' }}
          />
          <select
            value={p.style}
            onChange={(e) => updateChord(i, 'style', e.target.value)}
          >
            <option value="comping">Comping</option>
            <option value="arpeggio">Arpeggio</option>
          </select>
        </div>
      ))}

      <button onClick={addChord} style={{ marginTop: '1rem' }}>+ 코드 추가</button>

      <div style={{ marginTop: '1rem' }}>
        <button onClick={play}>▶ 재생</button>
        <button onClick={generateMidi} style={{ marginLeft: '1rem' }}>💾 MIDI 다운로드</button>
      </div>
    </div>
  );
}

export default App;
