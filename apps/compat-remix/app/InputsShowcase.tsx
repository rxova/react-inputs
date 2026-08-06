'use client'

import { useState } from 'react'
import {
  CurrencyInput,
  DateInput,
  FileInput,
  OtpInput,
  PasswordInput,
  PhoneInput,
  Rating,
  TagsInput,
  TimeInput,
} from '@rxova/react-inputs'

export function InputsShowcase() {
  const [currency, setCurrency] = useState<number | null>(null)
  const [rating, setRating] = useState(4)
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState<string | null>('2026-08-05')
  const [time, setTime] = useState<string | null>('14:30')
  const [tags, setTags] = useState(['react'])
  const [files, setFiles] = useState<File[]>([])

  return (
    <main>
      <h1>Framework compatibility</h1>
      <form style={{ display: 'grid', gap: 24, maxWidth: 520 }}>
        <label htmlFor="compat-currency">Price</label>
        <CurrencyInput
          id="compat-currency"
          name="price"
          locale="en-US"
          currency="USD"
          value={currency}
          onChange={setCurrency}
        />
        <output data-testid="currency-value">{currency ?? 'empty'}</output>

        <Rating label="Rating" name="rating" value={rating} onChange={setRating} />
        <output data-testid="rating-value">{rating}</output>

        <OtpInput label="Verification code" name="otp" value={otp} onChange={setOtp} />
        <output data-testid="otp-value">{otp}</output>

        <PasswordInput
          label="Password"
          name="password"
          value={password}
          onChange={setPassword}
          showStrength
        />
        <output data-testid="password-value">{password}</output>

        <PhoneInput
          label="Phone number"
          name="phone"
          value={phone}
          onChange={setPhone}
          defaultCountry="US"
        />
        <output data-testid="phone-value">{phone}</output>

        <DateInput label="Start date" name="date" value={date} onChange={setDate} locale="en-US" />
        <output data-testid="date-value">{date ?? 'empty'}</output>

        <TimeInput label="Start time" name="time" value={time} onChange={setTime} locale="en-US" />
        <output data-testid="time-value">{time ?? 'empty'}</output>

        <TagsInput label="Tags" name="tags" value={tags} onChange={setTags} />
        <output data-testid="tags-value">{tags.join(',')}</output>

        <FileInput label="Attachments" name="files" value={files} onChange={setFiles} multiple />
        <output data-testid="files-value">{files.map((file) => file.name).join(',')}</output>
      </form>
    </main>
  )
}
