import { Link } from 'react-router-dom'
import { useMemo, useRef, useState } from 'react'
import * as Tone from 'tone'

const KEY_LETTERS = /** @type {const} */ (['A', 'B', 'C', 'D', 'E', 'F', 'G'])

const MODE_INFO = {
  major: {
    modeName: 'Major',
    romanOptions: /** @type {const} */ (['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viio']),
    // Semitones from tonic for a major scale (incl. octave)
    scaleSemitones: /** @type {const} */ ([0, 2, 4, 5, 7, 9, 11, 12]),
    triadQualities: /** @type {const} */ (['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished']),
  },
  minor: {
    modeName: 'Minor (natural)',
    romanOptions: /** @type {const} */ (['i', 'iio', 'III', 'iv', 'v', 'VI', 'VII']),
    // Semitones from tonic for a natural minor scale (incl. octave)
    scaleSemitones: /** @type {const} */ ([0, 2, 3, 5, 7, 8, 10, 12]),
    triadQualities: /** @type {const} */ (['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major']),
  },
}

function pitchClassFromNote(note) {
  // Tone note format: e.g. C#4, Eb3
  return String(note).replace(/-?\d+$/, '')
}

function suffixForQuality(quality) {
  if (quality === 'minor') return 'm'
  if (quality === 'diminished') return 'dim'
  return ''
}

function buildChordInSameOctave(rootNote, intervals) {
  // Build chord tones from semitone intervals, but "wrap" tones down so they
  // stay within the *same octave number* as the root.
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

function buildQuizConfig(keyLetter, mode) {
  const modeInfo = MODE_INFO[mode]
  const tonic = `${keyLetter}4`

  const scaleNotes = modeInfo.scaleSemitones.map((s) => Tone.Frequency(tonic).transpose(s).toNote())

  const degreeSemitones = modeInfo.scaleSemitones.slice(0, 7)

  const triads = degreeSemitones.map((rootAbs, degree) => {
    const thirdDegree = degree + 2
    const fifthDegree = degree + 4

    const thirdAbs = degreeSemitones[thirdDegree % 7] + (thirdDegree >= 7 ? 12 : 0)
    const fifthAbs = degreeSemitones[fifthDegree % 7] + (fifthDegree >= 7 ? 12 : 0)

    const thirdInterval = thirdAbs - rootAbs
    const fifthInterval = fifthAbs - rootAbs

    const rootNote = Tone.Frequency(tonic).transpose(rootAbs).toNote()
    const chordNotes = buildChordInSameOctave(rootNote, [0, thirdInterval, fifthInterval])

    const quality = modeInfo.triadQualities[degree]
    const chordName = `${pitchClassFromNote(rootNote)}${suffixForQuality(quality)}`

    return {
      roman: modeInfo.romanOptions[degree],
      name: chordName,
      notes: chordNotes,
    }
  })

  return {
    name: `${keyLetter} ${modeInfo.modeName}`,
    romanOptions: modeInfo.romanOptions,
    scaleNotes,
    triads,
  }
}

export default function QuizPage() {
  const synthRef = useRef(null)
  const [audioReady, setAudioReady] = useState(false)
  const [keyLetter, setKeyLetter] = useState('C')
  const [mode, setMode] = useState('major')
  const [status, setStatus] = useState('Press play to begin')
  const [isPlaying, setIsPlaying] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [result, setResult] = useState(null)

  const config = useMemo(() => buildQuizConfig(keyLetter, mode), [keyLetter, mode])

  const triadsByRoman = useMemo(() => {
    const map = {}
    for (const triad of config.triads) map[triad.roman] = triad
    return map
  }, [config.triads])

  function resetQuizState(nextMode, nextKeyLetter) {
    if (typeof nextMode === 'string') setMode(nextMode)
    if (typeof nextKeyLetter === 'string') setKeyLetter(nextKeyLetter)

    setAnswer(null)
    setResult(null)
    setStatus('Press play to begin')
  }

  function getSynth() {
    if (synthRef.current) return synthRef.current

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.7 },
      volume: -10,
    }).toDestination()

    synthRef.current = synth
    return synth
  }

  async function ensureAudioStarted() {
    if (audioReady) return true

    try {
      await Tone.start()
      setAudioReady(true)
      return true
    } catch (err) {
      setStatus(`Failed to start audio: ${String(err)}`)
      return false
    }
  }

  function randInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive)
  }

  async function handlePlay() {
    if (isPlaying) return

    const ok = await ensureAudioStarted()
    if (!ok) return

    setIsPlaying(true)
    setResult(null)

    const triad = config.triads[randInt(config.triads.length)]
    setAnswer(triad.roman)
    setStatus(`Scale: ${config.name}. Listen…`)

    const synth = getSynth()

    // 1) Play the scale up in order
    const start = Tone.now() + 0.05
    const noteDur = 0.18
    const gap = 0.02

    config.scaleNotes.forEach((note, i) => {
      const t = start + i * (noteDur + gap)
      synth.triggerAttackRelease(note, noteDur, t)
    })

    // 2) Then play a random diatonic triad as a chord
    const afterScale = start + config.scaleNotes.length * (noteDur + gap) + 0.25
    const chordDur = 0.9
    synth.triggerAttackRelease(triad.notes, chordDur, afterScale)

    // Let the audio finish before enabling answers
    const totalTime = afterScale - start + chordDur + 0.35

    window.setTimeout(() => {
      setIsPlaying(false)
      setStatus('Which chord degree was that?')
    }, totalTime * 1000)
  }

  function handleGuess(roman) {
    if (!answer) return
    if (isPlaying) return

    const correct = roman === answer
    const triad = triadsByRoman[answer]
    setResult({
      guess: roman,
      correct,
      answer,
      details: triad ? `${triad.roman} (${triad.name})` : answer,
    })
    setStatus(correct ? 'Correct!' : 'Not quite — try again, or press Play for a new one')
  }

  return (
    <main className="page">
      <header className="header">
        <div className="headerRow">
          <div>
            <h1 className="title">Quiz</h1>
            <p className="subtitle">Scale: {config.name}</p>
          </div>

          <Link className="navLink" to="/">
            Back to home
          </Link>
        </div>
      </header>

      <section className="panel quizPanel">
        <div className="quizInner">
          <div className="quizStatus" role="status" aria-live="polite">
            {status}
          </div>

          <div className="quizControls" aria-label="Quiz controls">
            <label className="keyControl">
              <span className="keyLabel">Key</span>
              <select
                className="keySelect"
                value={keyLetter}
                onChange={(e) => resetQuizState(null, e.target.value)}
                disabled={isPlaying}
                aria-label="Select key"
              >
                {KEY_LETTERS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            <div className="modeToggle" role="group" aria-label="Select quiz mode">
              <button
                type="button"
                className={mode === 'major' ? 'toggleButton toggleButtonActive' : 'toggleButton'}
                onClick={() => resetQuizState('major', null)}
                disabled={isPlaying}
              >
                Major
              </button>
              <button
                type="button"
                className={mode === 'minor' ? 'toggleButton toggleButtonActive' : 'toggleButton'}
                onClick={() => resetQuizState('minor', null)}
                disabled={isPlaying}
              >
                Minor
              </button>
            </div>
          </div>

          <button type="button" className="playButton" onClick={handlePlay} disabled={isPlaying}>
            {isPlaying ? 'Playing…' : 'Play'}
          </button>

          <div className="quizOptions" role="group" aria-label="Chord degree options">
            {config.romanOptions.map((roman) => (
              <button
                key={roman}
                type="button"
                className="optionButton"
                onClick={() => handleGuess(roman)}
                disabled={!answer || isPlaying}
              >
                {roman}
              </button>
            ))}
          </div>

          {result ? (
            <div className="quizResult" data-correct={result.correct ? 'true' : 'false'}>
              <div>
                Your guess: <strong>{result.guess}</strong>
              </div>
              <div>
                Answer: <strong>{result.details}</strong>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
