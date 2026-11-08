// Shared by the build-time schema compiler and its generated browser validator.
// Bound the input before BigInt conversion; preserve the official uint formats.
export const uintFormats = Object.fromEntries([64, 96, 256].map(bits => [
  `uint${bits}-decimal`,
  {
    type: 'string',
    validate: value => /^(0|[1-9][0-9]*)$/.test(value)
      && value.length <= 78 && BigInt(value) < 2n ** BigInt(bits),
  },
]));
