// Synthetic stable IDs only; no real tournament chart mapping.
export const samplePools = Object.fromEntries(['siamese', 'tabby', 'ragdoll'].map(group => [group,
  Array.from({length:12}, (_, i) => ({id: `${group}-${i+1}`})),
]));
