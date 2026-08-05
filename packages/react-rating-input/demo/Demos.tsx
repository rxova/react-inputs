import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useForm as useTanstackForm } from '@tanstack/react-form'
import { Rating } from '@rxova/react-rating-input'
import { Section } from '@rxova/demo-kit'

/**
 * Every scenario the E2E suite drives, and the manual QA surface.
 *
 * Each block carries a `data-testid` so specs target intent rather than DOM
 * shape. Anything added here should be something worth checking in a real
 * page: full-page tab order, a genuine form round-trip, page-level RTL.
 */

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21z" />
    </svg>
  )
}

function InteractiveDemo() {
  const [score, setScore] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  return (
    <>
      <Rating
        value={score}
        onChange={setScore}
        onHoverChange={setHover}
        precision={0.5}
        label="Rate your meal"
      />
      <p>
        value: <output data-testid="interactive-value">{score}</output> · hover:{' '}
        <output data-testid="interactive-hover">{hover ?? 'none'}</output>
      </p>
    </>
  )
}

function NativeFormDemo() {
  const [submitted, setSubmitted] = useState<string | null>(null)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        setSubmitted(JSON.stringify(Object.fromEntries(data)))
      }}
    >
      <Rating
        name="score"
        defaultValue={0}
        onChange={() => undefined}
        precision={1}
        label="Score"
      />
      <button type="submit">Submit</button>
      <output data-testid="native-form-result">{submitted ?? 'not submitted'}</output>
    </form>
  )
}

function HookFormDemo() {
  const { control, handleSubmit } = useForm<{ rating: number }>({ defaultValues: { rating: 0 } })
  const [result, setResult] = useState<string | null>(null)

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit((values) => {
          setResult(JSON.stringify(values))
        })(e)
      }}
    >
      <Controller
        name="rating"
        control={control}
        rules={{ min: { value: 1, message: 'Please rate before submitting' } }}
        render={({ field, fieldState }) => (
          <>
            <Rating
              {...field}
              precision={0.5}
              label="Overall"
              invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? 'rhf-error' : undefined}
            />
            {fieldState.error && (
              <p id="rhf-error" role="alert" className="error">
                {fieldState.error.message}
              </p>
            )}
          </>
        )}
      />
      <button type="submit">Send review</button>
      <output data-testid="rhf-result">{result ?? 'not submitted'}</output>
    </form>
  )
}

function TanstackFormDemo() {
  const [result, setResult] = useState<string | null>(null)
  const form = useTanstackForm({
    defaultValues: { rating: 0 },
    onSubmit: ({ value }) => {
      setResult(JSON.stringify(value))
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field
        name="rating"
        validators={{
          onChange: ({ value }) => (value < 1 ? 'Please rate before submitting' : undefined),
        }}
      >
        {(field) => (
          <>
            <Rating
              name="rating"
              value={field.state.value}
              onChange={(v) => {
                field.handleChange(v)
              }}
              onBlur={field.handleBlur}
              precision={0.5}
              label="Overall"
              invalid={!field.state.meta.isValid}
              aria-describedby={field.state.meta.isValid ? undefined : 'tanstack-error'}
            />
            {!field.state.meta.isValid && (
              <p id="tanstack-error" role="alert" className="error">
                {field.state.meta.errors.join(', ')}
              </p>
            )}
          </>
        )}
      </form.Field>
      <button type="submit">Send review</button>
      <output data-testid="tanstack-result">{result ?? 'not submitted'}</output>
    </form>
  )
}

export function RatingDemos({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
  return (
    <main dir={dir}>
      <div className="grid">
        <Section id="display-continuous" title="Continuous" note="value 4.3, no rounding">
          <Rating value={4.3} />
        </Section>

        <Section id="display-whole" title="Whole stars" note="precision 1, nearest">
          <Rating value={4.3} precision={1} />
        </Section>

        <Section id="display-half" title="Half stars" note="precision 0.5, nearest">
          <Rating value={4.3} precision={0.5} />
        </Section>

        <Section id="display-emoji" title="Emoji" note='icon="⭐"'>
          <Rating value={3.5} icon="⭐" />
        </Section>

        <Section id="display-zwj" title="ZWJ emoji" note="must never clip mid-sequence">
          <Rating value={2.5} icon="👩‍🍳" />
        </Section>

        <Section id="display-custom-svg" title="Custom SVG" note="hearts, max 7">
          <Rating value={5.5} max={7} icon={<HeartIcon />} style={{ color: 'crimson' }} />
        </Section>

        <Section id="display-render-fn" title="Render function" note="per-icon state">
          <Rating value={2.5} icon={(s) => <span>{s.partial ? '◐' : s.filled ? '●' : '○'}</span>} />
        </Section>

        <Section id="display-scaled" title="Sized" note="--rx-rating-size: 2.5rem">
          <Rating value={3.7} style={{ ['--rx-rating-size' as string]: '2.5rem' }} />
        </Section>

        <Section id="interactive" title="Interactive" note="half steps, hover preview">
          <InteractiveDemo />
        </Section>

        <Section id="disabled" title="Disabled" note="still a radiogroup, still announced">
          <Rating value={3} onChange={() => undefined} precision={1} disabled label="Disabled" />
        </Section>

        <Section id="readonly" title="Read only" note="role=img, not focusable">
          <Rating value={3} onChange={() => undefined} readOnly label="Read only" />
        </Section>

        <Section id="native-form" title="Native form" note="no library, posts via name">
          <NativeFormDemo />
        </Section>

        <Section id="hook-form" title="React Hook Form" note="Controller + validation">
          <HookFormDemo />
        </Section>

        <Section id="tanstack-form" title="TanStack Form" note="form.Field + validation">
          <TanstackFormDemo />
        </Section>
      </div>
    </main>
  )
}

// See the note in the currency demo: the playground resolves the default.
export default RatingDemos
