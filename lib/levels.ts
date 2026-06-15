// lib/levels.ts
export function sortAscUnique(nums: number[]) {
  return Array.from(new Set(nums.filter((n) => Number.isFinite(n)))).sort((a, b) => a - b)
}

export function pickNearestLevels(params: {
  price: number
  supports: number[]
  resistances: number[]
}) {
  const { price } = params
  const supports = sortAscUnique(params.supports)
  const resistances = sortAscUnique(params.resistances)

  // Support: level terbesar yang masih di bawah harga
  const support = [...supports].filter((x) => x < price).pop() ?? supports[0] ?? price
  // Resistance: level terkecil yang masih di atas harga
  const resistance = resistances.find((x) => x > price) ?? resistances[resistances.length - 1] ?? price

  // Optional level kedua
  const support2 = [...supports].filter((x) => x < support).pop()
  const resistance2 = resistances.find((x) => x > resistance)

  return { support, resistance, support2, resistance2, supports, resistances }
}