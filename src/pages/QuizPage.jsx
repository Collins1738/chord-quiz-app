import { Link } from 'react-router-dom'
import { useMemo, useRef, useState } from 'react'
import * as Tone from 'tone'

const QUIZ_CONFIG = {
  major: {
    name: 'C Major',
    romanOptions: /** @type {const} */ (['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viio']),
    scaleNotes: /** @type {const} */ (['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']),
    triads: /** @type {const} */ ([
      { roman: 'I', name: 'C', notes: ['C4', 'E4', 'G4'] },
      { roman: 'ii', name: 'Dm', notes: ['D4', 'F4', 'A4'] },
      { roman: 'iii', name: 'Em', notes: ['E4', 'G4', 'B4'] },
      { roman: 'IV', name: 'F', notes: ['F4', 'A4', 'C4'] },
      { roman: 'V', name: 'G', notes: ['G4', 'B4', 'D4'] },
      { roman: 'vi', name: 'Am', notes: ['A4', 'C4', 'E4'] },
      { roman: 'viio', name: 'Bdim', notes: ['B4', 'D4', 'F4'] },
    ]),
  },
  minor: {
    name: 'C Minor (natural)',
    romanOptions: /** @type {const} */ (['i', 'iio', 'III', 'iv', 'v', 'VI', 'VII']),
    scaleNotes: /** @type {const} */ (['C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5']),
    triads: /** @type {const} */ ([
      { roman: 'i', name: 'Cm', notes: ['C4', 'Eb4', 'G4'] },
      { roman: 'iio', name: 'Ddim', notes: ['D4', 'F4', 'Ab4'] },
      { roman: 'III', name: 'Eb', notes: ['Eb4', 'G4', 'Bb4'] },
      { roman: 'iv', name: 'Fm', notes: ['F4', 'Ab4', 'C4'] },
      { roman: 'v', name: 'Gm', notes: ['G4', 'Bb4', 'D4'] },
      { roman: 'VI', name: 'Ab', notes: ['Ab4', 'C4', 'Eb4'] },
      { roman: 'VII', name: 'Bb', notes: ['Bb4', 'D4', 'F4'] },
    ]),
  },
}

export default function QuizPage() {
  const synthRef = useRef(null)
  const [audioReady, setAudioReady] = useState(false)
  const [mode, setMode] = useState('major')
  const [status, setStatus] = useState('Press play to begin')
  const [isPlaying, setIsPlaying] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [result, setResult] = useState(null)

  const config = QUIZ_CONFIG[mode]

  const triadsByRoman = useMemo(() => {
    const map = {}
    for (const triad of config.triads) map[triad.roman] = triad
    return map
  }, [config.triads])

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

    // 1) Play the scale up (C major) in order
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
    const totalTime = (afterScale - start) + chordDur + 0.35

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
            <p className="subtitle">Scale: {config.name} (hard-coded for now)</p>
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

          <div className="modeToggle" role="group" aria-label="Select quiz mode">
            <button
              type="button"
              className={mode === 'major' ? 'toggleButton toggleButtonActive' : 'toggleButton'}
              onClick={() => {
                setMode('major')
                setAnswer(null)
                setResult(null)
                setStatus('Press play to begin')
              }}
              disabled={isPlaying}
            >
              Major
            </button>
            <button
              type="button"
              className={mode === 'minor' ? 'toggleButton toggleButtonActive' : 'toggleButton'}
              onClick={() => {
                setMode('minor')
                setAnswer(null)
                setResult(null)
                setStatus('Press play to begin')
              }}
              disabled={isPlaying}
            >
              Minor
            </button>
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
