import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Tone from 'tone'

const ROOT_LETTERS = /** @type {const} */ (['C', 'D', 'E', 'F', 'G', 'A', 'B'])

const CHORD_QUALITIES = /** @type {const} */ ([
  { id: 'major', label: 'Major', intervals: [0, 4, 7] },
  { id: 'minor', label: 'Minor', intervals: [0, 3, 7] },
  { id: 'diminished', label: 'Diminished', intervals: [0, 3, 6] },
])

function buildChordInSameOctave(rootNote, intervals) {
  // Build chord tones from semitone intervals, but "wrap" tones down so they
  // stay within the *same octave number* as the root.
  //
  // Examples (root octave = 4):
  // - C4 major: C4 E4 G4 (already octave 4)
  // - A4 minor: A4 C5 E5  -> A4 C4 E4
  // - F4 major: F4 A4 C5  -> F4 A4 C4

  const rootOctave = Number(String(rootNote).match(/(-?\d+)$/)?.[1])
  if (!Number.isFinite(rootOctave)) return intervals.map((s) => Tone.Frequency(rootNote).transpose(s).toNote())

  return intervals.map((semitones) => {
    let midi = Tone.Frequency(rootNote).transpose(semitones).toMidi()
    // Convert to note to inspect octave. (Tone doesn't expose octave directly.)
    let note = Tone.Frequency(midi, 'midi').toNote()
    let noteOctave = Number(String(note).match(/(-?\d+)$/)?.[1])

    while (Number.isFinite(noteOctave) && noteOctave > rootOctave) {
      midi -= 12
      note = Tone.Frequency(midi, 'midi').toNote()
      noteOctave = Number(String(note).match(/(-?\d+)$/)?.[1])
    }

    return note
  })
}

export default function HomePage() {
  const synthRef = useRef(null)
  const [audioReady, setAudioReady] = useState(false)
  const [status, setStatus] = useState('Click any note/chord to start audio')
  const [octave, setOctave] = useState(4)

  function noteFromLetter(letter) {
    return `${letter}${octave}`
  }

  function getSynth() {
    if (synthRef.current) return synthRef.current

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.6 },
      volume: -10,
    }).toDestination()

    synthRef.current = synth
    return synth
  }

  async function ensureAudioStarted() {
    if (audioReady) return true

    try {
      // Browsers require a user gesture before audio can start.
      await Tone.start()
      setAudioReady(true)
      setStatus(`Audio started (context: ${Tone.getContext().state})`)
      return true
    } catch (err) {
      setStatus(`Failed to start audio: ${String(err)}`)
      return false
    }
  }

  async function handlePlayNote(letter) {
    const ok = await ensureAudioStarted()
    if (!ok) return

    const synth = getSynth()
    const note = noteFromLetter(letter)

    synth.triggerAttackRelease(note, '8n')
    setStatus(`Played ${note}`)
  }

  async function handlePlayChord(rootLetter, quality) {
    const ok = await ensureAudioStarted()
    if (!ok) return

    const synth = getSynth()
    const rootNote = noteFromLetter(rootLetter)
    const chordNotes = buildChordInSameOctave(rootNote, quality.intervals)

    synth.triggerAttackRelease(chordNotes, '4n')
    setStatus(`Played ${rootNote} ${quality.label}: ${chordNotes.join(' ')}`)
  }

  return (
    <main className="page">
      <header className="header">
        <div className="headerRow">
          <div>
            <h1 className="title">Chord Identifier</h1>
            <p className="subtitle">Tone.js test: play notes and basic triads.</p>
          </div>

          <Link className="navLink" to="/quiz">
            Go to quiz
          </Link>
        </div>
      </header>

      <section className="panel">
       

        <div className="controls">
          <label className="octaveControl">
            <span className="octaveLabel">Octave</span>
            <input
              className="octaveKnob"
              type="range"
              min={2}
              max={6}
              step={1}
              value={octave}
              onChange={(e) => setOctave(Number(e.target.value))}
              list="octaves"
              aria-label="Select octave"
            />
            <datalist id="octaves">
              <option value="2" />
              <option value="3" />
              <option value="4" />
              <option value="5" />
              <option value="6" />
            </datalist>
            <span className="octaveValue">{octave}</span>
          </label>
        </div>

        <div className="row">
          <span className="status" role="status" aria-live="polite">
            {status}
          </span>
        </div>

        <div className="chordMatrix" role="group" aria-label="Play notes and chords">
          {/* Row 1: root notes */}
          {ROOT_LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              className="noteButton"
              onClick={() => handlePlayNote(letter)}
              title={`Play ${noteFromLetter(letter)}`}
            >
              {noteFromLetter(letter)}
            </button>
          ))}

          {/* Rows 2-4: chord qualities */}
          {CHORD_QUALITIES.flatMap((quality) =>
            ROOT_LETTERS.map((letter) => (
              <button
                key={`${quality.id}:${letter}`}
                type="button"
                className="chordButton"
                onClick={() => handlePlayChord(letter, quality)}
                title={`Play ${noteFromLetter(letter)} ${quality.label}`}
              >
                {quality.label.toLowerCase()}
              </button>
            ))
          )}
        </div>

        <p className="hint">Audio will start on first click (some browsers require a user gesture).</p>
      </section>
    </main>
  )
}
